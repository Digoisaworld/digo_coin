/**
 * Phantom wallet integration.
 *
 * Only the public key and a signed *message* ever leave the device. DIGO
 * EVOLUTION never asks for, reads or stores a seed phrase or private key, and
 * never builds a transaction: wallet linking is authentication only.
 */

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string } | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signMessage(
    message: Uint8Array,
    display?: 'utf8' | 'hex',
  ): Promise<{ signature: Uint8Array; publicKey: { toBase58(): string } }>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
}

interface PhantomWindow extends Window {
  phantom?: { solana?: PhantomProvider };
  solana?: PhantomProvider;
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (const byte of bytes) {
    if (byte === 0) out += BASE58_ALPHABET[0];
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i -= 1) out += BASE58_ALPHABET[digits[i]];
  return out;
}

export function getPhantom(): PhantomProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as PhantomWindow;
  const provider = w.phantom?.solana ?? w.solana;
  if (provider && typeof provider.connect === 'function') return provider;
  return null;
}

export function isPhantomInstalled(): boolean {
  return getPhantom() !== null;
}

export interface ConnectResult {
  address: string;
  provider: PhantomProvider;
}

export async function connectPhantom(): Promise<ConnectResult> {
  const provider = getPhantom();
  if (!provider) {
    throw new Error(
      'Phantom wallet not found. Install the Phantom extension or open this page inside the Phantom mobile browser.',
    );
  }
  const response = await provider.connect();
  const address = response?.publicKey?.toBase58?.() ?? provider.publicKey?.toBase58?.();
  if (!address) throw new Error('Phantom did not return a public key.');
  return { address, provider };
}

export async function signMessageWithPhantom(message: string): Promise<string> {
  const provider = getPhantom();
  if (!provider) throw new Error('Phantom wallet not found.');
  const encoded = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(encoded, 'utf8');
  return base58Encode(signature);
}

export async function disconnectPhantom(): Promise<void> {
  const provider = getPhantom();
  if (!provider) return;
  try {
    await provider.disconnect();
  } catch {
    /* the user may have already disconnected */
  }
}
