import type { NextFunction, Request, Response } from "express";
import { getRequestContext } from "../lib/request-context";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export function rateLimit(request: Request, response: Response, next: NextFunction): void {
  const context = getRequestContext(request, response);
  const now = Date.now();
  const key = `${context.deviceTokenHash}:${context.ipAddress ?? "unknown"}:${request.path}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS) {
    response.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
    response.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
    return;
  }
  next();
}