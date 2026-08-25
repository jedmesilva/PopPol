import { eq } from "drizzle-orm";
import { db, poppolCheckoutIntentsTable, poppolManifestationsTable } from "@workspace/db";
import { getStripeSync } from "./stripeClient";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) throw new Error("Stripe webhook payload must be a Buffer.");
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    const event = JSON.parse(payload.toString("utf8")) as {
      type?: string;
      data?: { object?: { metadata?: { checkoutIntentId?: string }; id?: string } };
    };
    if (event.type !== "checkout.session.completed") return;
    const intentId = event.data?.object?.metadata?.checkoutIntentId;
    if (!intentId) return;

    await db.transaction(async (tx) => {
      const [intent] = await tx
        .select()
        .from(poppolCheckoutIntentsTable)
        .where(eq(poppolCheckoutIntentsTable.id, intentId));
      if (!intent || intent.status === "paid") return;
      if (intent.status !== "pending" || intent.expiresAt.getTime() < Date.now()) return;

      await tx
        .update(poppolCheckoutIntentsTable)
        .set({ status: "paid", providerSessionId: event.data?.object?.id ?? null, paidAt: new Date() })
        .where(eq(poppolCheckoutIntentsTable.id, intent.id));

      await tx.insert(poppolManifestationsTable).values(
        intent.lineItems.map((lineItem, index) => ({
          id: `manifestation-${intent.id}-${index}`,
          politicianId: intent.politicianId,
          itemId: lineItem.itemId,
          quantity: lineItem.quantity,
          checkoutIntentId: intent.id,
          deviceTokenHash: intent.deviceTokenHash,
          ipAddress: intent.ipAddress,
          countryCode: intent.countryCode,
          stateCode: intent.stateCode,
          city: intent.city,
          referrer: intent.referrer,
          campaign: intent.campaign,
        })),
      ).onConflictDoNothing();
    });
  }
}