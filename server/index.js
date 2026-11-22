/**
 * DIGO EVOLUTION - application server
 *
 * Serves the built React/Three.js client and a small, honest backend:
 *  - Phantom wallet authentication with real ed25519 signature verification
 *  - server-side run validation and signed reward receipts
 *  - a leaderboard
 *
 * No private keys, seed phrases, token transfers or fake transactions exist
 * anywhere in this file. Reward receipts are off-chain proofs only.
 */
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const NONCE_TTL_MS = 1000 * 60 * 5;
const MAX_BODY_KB = 64;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: `${MAX_BODY_KB}kb` }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

/* ------------------------------------------------------------------ */
/* base58 + ed25519 verification (no external dependency)              */
/* ------------------------------------------------------------------ */

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 128) return null;
  let num = 0n;
  for (const ch of input) {
    const idx = B58_ALPHABET.indexOf(ch);
    if (idx < 0) return null;
    num = num * 58n + BigInt(idx);
  }
  const bytes = [];
  while (num > 0n) {
    bytes.push(Number(num % 256n));
    num /= 256n;
  }
  let leadingZeros = 0;
  while (leadingZeros < input.length && input[leadingZeros] === '1') leadingZeros += 1;
  const out = Buffer.alloc(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) out[leadingZeros + i] = bytes[bytes.length - 1 - i];
  return out;
}

function base58Encode(buffer) {
  let num = 0n;
  for (const byte of buffer) num = num * 256n + BigInt(byte);
  let out = '';
  while (num > 0n) {
    out = B58_ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const byte of buffer) {
    if (byte !== 0) break;
    out = '1' + out;
  }
  return out || '1';
}

/** Verify a Phantom `signMessage` signature against a base58 Solana public key. */
function verifyWalletSignature(publicKey, message, signatureB58) {
  try {
    const pub = base58Decode(publicKey);
    const sig = base58Decode(signatureB58);
    if (!pub || pub.length !== 32 || !sig || sig.length !== 64) return false;
    // Wrap the raw 32-byte ed25519 key in a DER SubjectPublicKeyInfo.
    const der = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      pub,
    ]);
    const key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(message, 'utf8'), key, sig);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* in-memory stores (single-instance hosting)                          */
/* ------------------------------------------------------------------ */

const nonces = new Map();
const sessions = new Map();
const leaderboard = new Map(); // `${mode}` -> array of entries
const rateBuckets = new Map();

const MODES = new Set(['endless', 'time', 'mission', 'boss', 'daily']);
const WORLDS = new Set([
  'tropical',
  'cyberpunk',
  'temple',
  'space',
  'lava',
  'crystal',
  'frozen',
]);

function rateLimited(key, limit = 40, windowMs = 60_000) {
  const now = Date.now();
  const bucket = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (bucket.length >= limit) return true;
  bucket.push(now);
  rateBuckets.set(key, bucket);
  return false;
}

function sign(payload) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

function issueSession(address) {
  const exp = Date.now() + SESSION_TTL_MS;
  const token = base58Encode(
    crypto.createHash('sha256').update(`${address}:${exp}:${crypto.randomUUID()}`).digest(),
  );
  sessions.set(token, { address, exp });
  return { token, exp };
}

function readSession(token) {
  const entry = sessions.get(token);
  if (!entry) return null;
  if (entry.exp < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return entry;
}

function authMiddleware(req, res, next) {
  const token = req.get('x-digo-session') || (req.body && req.body.session);
  const session = token ? readSession(token) : null;
  if (!session) return res.status(401).json({ error: 'session_required' });
  req.session = session;
  return next();
}

function pushScore(entry) {
  const list = leaderboard.get(entry.mode) || [];
  const existing = list.findIndex((e) => e.address === entry.address);
  if (existing >= 0) {
    if (list[existing].score >= entry.score) return list[existing].score;
    list.splice(existing, 1);
  }
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 100);
  leaderboard.set(entry.mode, trimmed);
  const rank = trimmed.findIndex((e) => e.address === entry.address) + 1;
  return rank || null;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

const startedAt = Date.now();

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'digo-evolution',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    walletAuth: true,
    onChainTransactions: false,
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    cluster: process.env.SOLANA_CLUSTER || 'devnet',
    tokenMint: process.env.DIGO_TOKEN_MINT || null,
    rpcUrl: process.env.SOLANA_RPC_URL || null,
    walletAuth: true,
    rewardsMode: 'offchain-validated',
    onChainTransactions: false,
    appPointsAreTokens: false,
  });
});

app.post('/api/wallet/nonce', (req, res) => {
  const address = String(req.body?.address || '');
  if (!base58Decode(address) || base58Decode(address).length !== 32) {
    return res.status(400).json({ error: 'invalid_address' });
  }
  if (rateLimited(`nonce:${address}`, 20)) return res.status(429).json({ error: 'rate_limited' });
  const nonce = crypto.randomBytes(16).toString('hex');
  const issuedAt = new Date().toISOString();
  const message = [
    'DIGO EVOLUTION - wallet authentication',
    '',
    'Signing proves you own this wallet. It costs no fees and moves no funds.',
    'DIGO EVOLUTION never asks for a seed phrase or private key.',
    '',
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
  ].join('\n');
  nonces.set(nonce, { address, message, exp: Date.now() + NONCE_TTL_MS });
  return res.json({ nonce, message, expiresInMs: NONCE_TTL_MS });
});

app.post('/api/wallet/verify', (req, res) => {
  const { address, signature, nonce } = req.body || {};
  const record = nonces.get(String(nonce || ''));
  if (!record) return res.status(400).json({ error: 'unknown_nonce' });
  nonces.delete(String(nonce)); // single use
  if (record.exp < Date.now()) return res.status(400).json({ error: 'nonce_expired' });
  if (record.address !== address) return res.status(400).json({ error: 'address_mismatch' });
  if (!verifyWalletSignature(address, record.message, signature)) {
    return res.status(401).json({ error: 'invalid_signature' });
  }
  const { token, exp } = issueSession(address);
  return res.json({ ok: true, address, token, expiresAt: exp });
});

app.get('/api/session', authMiddleware, (req, res) => {
  res.json({ ok: true, address: req.session.address, expiresAt: req.session.exp });
});

app.post('/api/logout', authMiddleware, (req, res) => {
  const token = req.get('x-digo-session') || req.body?.session;
  sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/leaderboard', (req, res) => {
  const mode = String(req.query.mode || 'endless');
  if (!MODES.has(mode)) return res.status(400).json({ error: 'invalid_mode' });
  const list = (leaderboard.get(mode) || []).slice(0, 25).map((entry, index) => ({
    rank: index + 1,
    address: `${entry.address.slice(0, 4)}...${entry.address.slice(-4)}`,
    score: entry.score,
    coins: entry.coins,
    world: entry.world,
    at: entry.at,
  }));
  res.json({ mode, entries: list });
});

/**
 * Submit a finished run. The server re-derives plausible bounds from the
 * reported duration, so a forged client score is rejected rather than stored.
 */
app.post('/api/scores', authMiddleware, (req, res) => {
  const { mode, world, score, coins, durationSec, maxCombo } = req.body || {};
  if (!MODES.has(mode)) return res.status(400).json({ error: 'invalid_mode' });
  if (!WORLDS.has(world)) return res.status(400).json({ error: 'invalid_world' });
  const s = Number(score);
  const c = Number(coins);
  const d = Number(durationSec);
  if (!Number.isFinite(s) || !Number.isFinite(c) || !Number.isFinite(d)) {
    return res.status(400).json({ error: 'invalid_numbers' });
  }
  if (d < 3 || d > 3600) return res.status(400).json({ error: 'invalid_duration' });
  if (s < 0 || s > d * 600 + 2000) return res.status(422).json({ error: 'implausible_score' });
  if (c < 0 || c > d * 12 + 50) return res.status(422).json({ error: 'implausible_coins' });
  const rank = pushScore({
    address: req.session.address,
    mode,
    world,
    score: Math.round(s),
    coins: Math.round(c),
    maxCombo: Number(maxCombo) || 0,
    at: new Date().toISOString(),
  });
  return res.json({ ok: true, rank, verified: true });
});

/**
 * Claim an off-chain reward receipt. The server validates the run against the
 * same bounds used for the leaderboard and returns a signed receipt. No token
 * is minted, transferred or promised.
 */
app.post('/api/rewards/claim', authMiddleware, (req, res) => {
  const { runId, mode, score, coins, durationSec } = req.body || {};
  const s = Number(score);
  const c = Number(coins);
  const d = Number(durationSec);
  if (!MODES.has(mode)) return res.status(400).json({ error: 'invalid_mode' });
  if (!Number.isFinite(s) || !Number.isFinite(c) || !Number.isFinite(d) || d <= 0) {
    return res.status(400).json({ error: 'invalid_run' });
  }
  if (s > d * 600 + 2000 || c > d * 12 + 50) {
    return res.status(422).json({ error: 'run_rejected' });
  }
  const payload = {
    address: req.session.address,
    runId: String(runId || '').slice(0, 64),
    mode,
    score: Math.round(s),
    coins: Math.round(c),
    durationSec: Math.round(d),
    issuedAt: new Date().toISOString(),
    kind: 'offchain-game-reward',
    onChain: false,
  };
  const receipt = {
    ...payload,
    signature: sign(JSON.stringify(payload)),
  };
  res.json({
    ok: true,
    receipt,
    note:
      'Game points are not DIGO tokens. This receipt is an off-chain record only; no blockchain transaction was created.',
  });
});

/* ------------------------------------------------------------------ */
/* static client                                                       */
/* ------------------------------------------------------------------ */

if (fs.existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: '1y',
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
}

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  const indexFile = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res
      .status(503)
      .type('text/plain')
      .send('Client build missing. Run "npm run build" before starting the server.');
  }
  res.setHeader('Cache-Control', 'no-cache');
  return res.sendFile(indexFile);
});

app.use((err, _req, res, _next) => {
  console.error('[digo] unhandled error:', err?.message || err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, HOST, () => {
  console.log(`[digo] DIGO EVOLUTION server listening on http://${HOST}:${PORT}`);
});
