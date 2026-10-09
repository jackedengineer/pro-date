export interface AdmissionLimits {
  peerBurst: number;
  peerRate: number;
  maxPeers: number;
  peerIdleMs: number;
  maxVerifications: number;
  maxAccountSockets: number;
  maxSockets: number;
}
export const defaultAdmissionLimits: AdmissionLimits = {
  peerBurst: 60,
  peerRate: 2,
  maxPeers: 10_000,
  peerIdleMs: 60_000,
  maxVerifications: 32,
  maxAccountSockets: 4,
  maxSockets: 1000,
};
type Rejection = { code: 'RATE_LIMITED' | 'SERVER_BUSY'; retryAfterMs: number };

// Process-local budgets, not a proxy-aware public-IP limiter. Never use forwarded input.
export class RealtimeAdmission {
  private peers = new Map<string, { tokens: number; updatedAt: number }>();
  private accounts = new Map<string, number>();
  private verifications = 0;
  private sockets = 0;
  private limits: AdmissionLimits;
  constructor(
    limits: Partial<AdmissionLimits> = {},
    private now = Date.now,
  ) {
    this.limits = { ...defaultAdmissionLimits, ...limits };
  }
  admitPeer(address: string): Rejection | null {
    const peer = address.replace(/^::ffff:/, '');
    const now = this.now();
    let budget = this.peers.get(peer);
    if (budget === undefined || now - budget.updatedAt >= this.limits.peerIdleMs) {
      // Prune only on insertion/expiry; normal reconnects are O(1).
      for (const [key, entry] of this.peers)
        if (now - entry.updatedAt >= this.limits.peerIdleMs) this.peers.delete(key);
      if (this.peers.size >= this.limits.maxPeers)
        return { code: 'SERVER_BUSY', retryAfterMs: this.limits.peerIdleMs };
      budget = { tokens: this.limits.peerBurst, updatedAt: now };
      this.peers.set(peer, budget);
    }
    budget.tokens = Math.min(
      this.limits.peerBurst,
      budget.tokens + (Math.max(0, now - budget.updatedAt) / 1000) * this.limits.peerRate,
    );
    budget.updatedAt = now;
    if (budget.tokens < 1)
      return {
        code: 'RATE_LIMITED',
        retryAfterMs: Math.ceil(((1 - budget.tokens) / this.limits.peerRate) * 1000),
      };
    budget.tokens -= 1;
    return null;
  }
  reserveVerification(): (() => void) | null {
    if (this.verifications >= this.limits.maxVerifications) return null;
    this.verifications += 1;
    return this.once(() => {
      this.verifications -= 1;
    });
  }
  reserveSocket(userId: string): (() => void) | null {
    const count = this.accounts.get(userId) ?? 0;
    if (count >= this.limits.maxAccountSockets || this.sockets >= this.limits.maxSockets)
      return null;
    this.sockets += 1;
    this.accounts.set(userId, count + 1);
    return this.once(() => {
      this.sockets -= 1;
      const remaining = (this.accounts.get(userId) ?? 1) - 1;
      if (remaining === 0) this.accounts.delete(userId);
      else this.accounts.set(userId, remaining);
    });
  }
  snapshot() {
    return {
      peers: this.peers.size,
      verifications: this.verifications,
      sockets: this.sockets,
      accounts: this.accounts.size,
    };
  }
  private once(release: () => void) {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      release();
    };
  }
}
