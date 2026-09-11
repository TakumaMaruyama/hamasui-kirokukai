// Shared by the Edge middleware and server routes: keep this module Web API only.
export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

export class AdminSessionConfigurationError extends Error {
  constructor() {
    super("ADMIN_SESSION_SECRET must be a 32-byte secret encoded as 64 hexadecimal characters");
    this.name = "AdminSessionConfigurationError";
  }
}

function fromHex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signingKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new AdminSessionConfigurationError();
  }
  return crypto.subtle.importKey("raw", fromHex(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createAdminSession(): Promise<string> {
  const key = await signingKey();
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v1.${issuedAt}.${issuedAt + ADMIN_SESSION_TTL_SECONDS}.${nonce}`;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toHex(new Uint8Array(signature))}`;
}

export async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token || token.length > 160) return false;
  const match = /^(v1\.(0|[1-9][0-9]{0,11})\.(0|[1-9][0-9]{0,11})\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;

  const issuedAt = Number(match[2]);
  const expiresAt = Number(match[3]);
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now || expiresAt <= now || expiresAt - issuedAt !== ADMIN_SESSION_TTL_SECONDS) return false;

  try {
    const key = await signingKey();
    return await crypto.subtle.verify("HMAC", key, fromHex(match[4]), new TextEncoder().encode(match[1]));
  } catch {
    return false;
  }
}
