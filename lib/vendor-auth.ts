import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const VENDOR_COOKIE = "vendor_session_013";
export const VENDOR_SESSION_SECONDS = 8 * 60 * 60;

function equalText(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function validVendorPassword(candidate: unknown, password: string | undefined): boolean {
  return typeof candidate === "string" && candidate.length <= 256 && !!password && password.length >= 1 && equalText(candidate, password);
}

function signature(payload: string, password: string) {
  return createHmac("sha256", password).update(`vendor-013:${payload}`).digest("base64url");
}

export function createVendorSession(password: string, now = Math.floor(Date.now() / 1000)): string {
  const payload = `${now + VENDOR_SESSION_SECONDS}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${signature(payload, password)}`;
}

export function isValidVendorSession(token: unknown, password: string | undefined, now = Math.floor(Date.now() / 1000)): boolean {
  if (typeof token !== "string" || !password || password.length < 1 || token.length > 160) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{22}$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return false;
  const expires = Number(parts[0]);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + VENDOR_SESSION_SECONDS) return false;
  return equalText(parts[2], signature(`${parts[0]}.${parts[1]}`, password));
}
