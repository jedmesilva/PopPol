import { randomBytes, createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  CreateCheckoutIntentBody,
  CreateCheckoutIntentResponse,
} from "@workspace/api-zod";
import {
  db,
  poppolCheckoutIntentsTable,
  poppolItemsTable,
  poppolPoliticiansTable,
} from "@workspace/db";
import { ensurePoppolSeeded } from "../lib/poppol-data";
import { getRequestContext } from "../lib/request-context";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

router.post("/checkout-intents", async (req, res): Promise<void> => {
  const parsed = CreateCheckoutIntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Checkout inválido" });
    return;
  }

  await ensurePoppolSeeded();
  const [politician] = await db
    .select({ id: poppolPoliticiansTable.id })
    .from(poppolPoliticiansTable)
    .where(eq(poppolPoliticiansTable.id, parsed.data.politicianId));
  if (!politician) {
    res.status(404).json({ error: "Político não encontrado" });
    return;
  }

  const itemIds = parsed.data.items.map((item) => item.itemId);
  const items = await db
    .select()
    .from(poppolItemsTable)
    .where(inArray(poppolItemsTable.id, itemIds));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const lineItems = parsed.data.items.map((line) => {
    const item = itemMap.get(line.itemId);
    if (!item) return null;
    return { itemId: item.id, quantity: line.quantity, priceCents: item.priceCents };
  });
  if (lineItems.some((item) => item === null)) {
    res.status(400).json({ error: "Item de checkout inválido" });
    return;
  }

  const validLineItems = lineItems as Array<{ itemId: string; quantity: number; priceCents: number }>;
  const amountCents = validLineItems.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
  const checkoutToken = randomBytes(32).toString("hex");
  const id = `checkout-${randomBytes(16).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const context = getRequestContext(req, res);
  const stripeItems = validLineItems.map((lineItem) => {
    const item = itemMap.get(lineItem.itemId);
    return item?.stripePriceId ? { price: item.stripePriceId, quantity: lineItem.quantity } : null;
  });
  if (stripeItems.some((item) => item === null)) {
    res.status(503).json({ error: "Checkout ainda não foi configurado para este item." });
    return;
  }

  const origin = req.get("origin") || `${req.protocol}://${req.get("host")}`;
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: stripeItems as Array<{ price: string; quantity: number }>,
      client_reference_id: id,
      metadata: { checkoutIntentId: id },
      success_url: `${origin}/?checkout=success&intent=${encodeURIComponent(id)}`,
      cancel_url: `${origin}/?checkout=canceled&intent=${encodeURIComponent(id)}`,
    },
    { idempotencyKey: `checkout-intent-${id}` },
  );
  if (!session.url) {
    res.status(502).json({ error: "Stripe não retornou uma URL de checkout." });
    return;
  }

  await db.insert(poppolCheckoutIntentsTable).values({
    id,
    tokenHash: hashToken(checkoutToken),
    deviceTokenHash: context.deviceTokenHash,
    politicianId: politician.id,
    lineItems: validLineItems,
    amountCents,
    status: "pending",
    providerSessionId: session.id,
    expiresAt,
    ipAddress: context.ipAddress,
    countryCode: context.countryCode,
    stateCode: context.stateCode,
    city: context.city,
    referrer: context.referrer,
    campaign: context.campaign,
  });

  res.status(201).json(CreateCheckoutIntentResponse.parse({
    id,
    checkoutToken,
    politicianId: politician.id,
    amountCents,
    status: "pending",
    expiresAt,
  }));
});

export default router;