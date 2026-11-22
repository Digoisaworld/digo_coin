/** Thin client for the DIGO EVOLUTION backend. */

export interface LeaderboardEntry {
  rank: number;
  address: string;
  score: number;
  coins: number;
  world: string;
  at: string;
}

export interface ServerConfig {
  walletAuth: boolean;
  appPointsAreTokens: false;
  [key: string]: unknown;
}

export interface ScoreSubmission {
  mode: string;
  world: string;
  score: number;
  coins: number;
  durationSec: number;
  maxCombo: number;
}

const TOKEN_KEY = 'digo.session.token';
const ADDRESS_KEY = 'digo.session.address';

class ApiClient {
  private token: string | null = null;
  private address: string | null = null;

  constructor() {
    try {
      this.token = localStorage.getItem(TOKEN_KEY);
      this.address = localStorage.getItem(ADDRESS_KEY);
    } catch {
      /* storage can be blocked in private mode */
    }
  }

  get sessionAddress(): string | null {
    return this.address;
  }

  get isLinked(): boolean {
    return Boolean(this.token && this.address);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.token) headers['x-digo-session'] = this.token;
    return headers;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers as Record<string, string> | undefined) },
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : {};
    if (!response.ok) {
      const message =
        (data as { error?: string }).error ?? `Request failed with status ${response.status}`;
      throw new Error(message);
    }
    return data as T;
  }

  async config(): Promise<ServerConfig> {
    return this.request<ServerConfig>('/api/config');
  }

  async nonce(address: string): Promise<{ nonce: string; message: string }> {
    return this.request('/api/wallet/nonce', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  async verify(
    address: string,
    signature: string,
    nonce: string,
  ): Promise<{ token: string; address: string; expiresAt: number }> {
    const result = await this.request<{ token: string; address: string; expiresAt: number }>(
      '/api/wallet/verify',
      { method: 'POST', body: JSON.stringify({ address, signature, nonce }) },
    );
    this.token = result.token;
    this.address = result.address;
    try {
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(ADDRESS_KEY, result.address);
    } catch {
      /* ignore */
    }
    return result;
  }

  async logout(): Promise<void> {
    try {
      if (this.token) await this.request('/api/logout', { method: 'POST' });
    } catch {
      /* the local session is cleared regardless */
    }
    this.token = null;
    this.address = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADDRESS_KEY);
    } catch {
      /* ignore */
    }
  }

  async leaderboard(mode: string): Promise<LeaderboardEntry[]> {
    const data = await this.request<{ entries: LeaderboardEntry[] }>(
      `/api/leaderboard?mode=${encodeURIComponent(mode)}`,
    );
    return data.entries;
  }

  async submitScore(payload: ScoreSubmission): Promise<{ rank: number; verified: boolean }> {
    return this.request('/api/scores', { method: 'POST', body: JSON.stringify(payload) });
  }

  async claimReward(payload: {
    runId: string;
    mode: string;
    score: number;
    coins: number;
    durationSec: number;
  }): Promise<{ receipt: Record<string, unknown>; note: string }> {
    return this.request('/api/rewards/claim', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();
