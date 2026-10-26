// Web Crypto API helpers for password hashing, salt, and OTP generation.
// Fully compatible with Cloudflare Workers / Pages Functions runtime.

export function generateSalt(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === storedHash;
}

export function generateNumericOtp(length = 6): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const num = array[0] % Math.pow(10, length);
  return num.toString().padStart(length, '0');
}

export function generateToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// In-memory token cache to avoid repeated D1 database hits for legacy tokens
const memoryTokenCache = new Map<string, { userId: string; expiresAt: number }>();

/**
 * Creates a stateless, HMAC-SHA256 signed session token.
 * Format: s_v1.<base64UrlPayload>.<hexSignature>
 * Can be verified in 0ms without hitting D1 database.
 */
export async function createSessionToken(
  userId: string,
  secret?: string,
  expiryDays = 30
): Promise<string> {
  const signingSecret = secret || 'sonexa-secure-cloud-session-secret-salt-2025';
  const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000;
  const payloadStr = JSON.stringify({ u: userId, exp: expiresAt });
  const payloadB64 = btoa(payloadStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `s_v1.${payloadB64}.${signatureHex}`;
}

/**
 * Verifies a stateless signed session token without any database query.
 */
export async function verifySessionToken(
  token: string,
  secret?: string
): Promise<{ userId: string } | null> {
  if (!token.startsWith('s_v1.')) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [, payloadB64, signatureHex] = parts;
  const signingSecret = secret || 'sonexa-secure-cloud-session-secret-salt-2025';

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(
      (signatureHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
    );

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payloadB64));
    if (!isValid) return null;

    // Restore base64
    let base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const decoded = JSON.parse(atob(base64));

    if (!decoded.u || !decoded.exp || Date.now() > decoded.exp) {
      return null;
    }

    return { userId: decoded.u };
  } catch {
    return null;
  }
}

/**
 * Fast request authenticator for Cloudflare Workers:
 * 1. Verifies signed token statelessly (0 D1 row reads)
 * 2. Checks in-memory cache for legacy tokens (0 D1 row reads)
 * 3. Falls back to D1 auth_tokens only when necessary, caching the result
 */
export async function authenticateRequest(
  request: Request,
  env: any
): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  // 1. Try stateless cryptographic verification first (0 D1 reads)
  const statelessAuth = await verifySessionToken(token, env?.JWT_SECRET);
  if (statelessAuth) {
    return statelessAuth;
  }

  // 2. Check memory cache for legacy or DB tokens (0 D1 reads)
  const cached = memoryTokenCache.get(token);
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      return { userId: cached.userId };
    }
    memoryTokenCache.delete(token);
  }

  // 3. Fallback to D1 database lookup
  if (env?.DB) {
    try {
      const tokenRecord = await env.DB.prepare(
        'SELECT user_id, expires_at FROM auth_tokens WHERE token = ? AND type = "session"'
      )
        .bind(token)
        .first();

      if (tokenRecord && Date.now() <= tokenRecord.expires_at) {
        // Cache for 15 minutes to eliminate subsequent D1 reads
        const cacheTtl = Math.min(tokenRecord.expires_at, Date.now() + 15 * 60 * 1000);
        if (memoryTokenCache.size > 2000) {
          memoryTokenCache.clear();
        }
        memoryTokenCache.set(token, { userId: tokenRecord.user_id, expiresAt: cacheTtl });
        return { userId: tokenRecord.user_id };
      }
    } catch (e) {
      console.error('Error querying auth_tokens:', e);
    }
  }

  return null;
}
