import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";

const DEVICE_COOKIE = "poppol_device";
const DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

export function ensureDeviceToken(request: Request, response: Response): string {
  const cached = (request as Request & { poppolDeviceToken?: string }).poppolDeviceToken;
  if (cached) return cached;
  const existing = readCookie(request, DEVICE_COOKIE);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) {
    (request as Request & { poppolDeviceToken?: string }).poppolDeviceToken = existing;
    return existing;
  }

  const token = randomBytes(32).toString("hex");
  (request as Request & { poppolDeviceToken?: string }).poppolDeviceToken = token;
  response.setHeader(
    "Set-Cookie",
    `${DEVICE_COOKIE}=${token}; Path=/; Max-Age=${DEVICE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  );
  return token;
}

export function getRequestContext(request: Request, response: Response) {
  const deviceToken = ensureDeviceToken(request, response);
  const campaign: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = typeof request.query[key] === "string" ? request.query[key] : undefined;
    if (value && value.length <= 160) campaign[key] = value;
  }

  const trustedGeoHeaders = process.env.TRUSTED_GEO_HEADERS === "true";
  return {
    deviceTokenHash: hash(deviceToken),
    ipAddress: request.ip || request.socket.remoteAddress || null,
    userAgent: request.get("user-agent")?.slice(0, 512) || null,
    referrer: request.get("referer")?.slice(0, 2048) || null,
    campaign: Object.keys(campaign).length > 0 ? campaign : null,
    // Only consume geo headers when a trusted proxy/geocoder is explicitly
    // configured. Otherwise a browser must never be able to claim a location.
    countryCode: trustedGeoHeaders ? request.get("x-geo-country")?.slice(0, 8) || null : null,
    stateCode: trustedGeoHeaders ? request.get("x-geo-state")?.slice(0, 16) || null : null,
    city: trustedGeoHeaders ? request.get("x-geo-city")?.slice(0, 160) || null : null,
  };
}

export function hashDeviceToken(token: string): string {
  return hash(token);
}