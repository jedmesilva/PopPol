import Stripe from "stripe";

export async function getUncachableStripeClient(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const replitToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!hostname || !replitToken) throw new Error("Stripe integration environment is not available.");
  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    { headers: { Accept: "application/json", X_REPLIT_TOKEN: replitToken }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`Failed to fetch Stripe credentials: ${response.status}`);
  const data = await response.json() as { items?: Array<{ settings?: { secret_key?: string } }> };
  const secretKey = data.items?.[0]?.settings?.secret_key;
  if (!secretKey) throw new Error("Stripe is not connected or has no secret key.");
  return new Stripe(secretKey);
}