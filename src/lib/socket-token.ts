import crypto from "crypto";

// Lightweight signed token used to authenticate Socket.io connections.
// The browser obtains one from a session-protected API route, then hands it
// to the realtime server, which verifies it with the same shared secret.
// Format: base64url(payloadJSON).base64url(hmacSHA256)

const SECRET = process.env.AUTH_SECRET ?? "dev-insecure-secret";
const TTL_SECONDS = 60 * 5; // 5 minutes

interface TokenPayload {
  userId: string;
  exp: number; // unix seconds
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSocketToken(userId: string): string {
  const payload: TokenPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySocketToken(token: string): { userId: string } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  // Constant-time comparison.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as TokenPayload;
    if (!payload.userId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
