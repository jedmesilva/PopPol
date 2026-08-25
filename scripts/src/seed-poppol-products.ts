import { eq } from "drizzle-orm";
import { db, poppolItemsTable } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";

async function main(): Promise<void> {
  const stripe = await getUncachableStripeClient();
  const items = await db.select().from(poppolItemsTable);
  const products = await stripe.products.list({ active: true, limit: 100 });

  for (const item of items) {
    const existing = products.data.find((product) => product.metadata?.poppolItemId === item.id);
    const product = existing ?? await stripe.products.create({
      name: `PopPol · ${item.label}`,
      description: item.hint,
      metadata: { poppolItemId: item.id, kind: item.type },
    });
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    const price = prices.data.find((candidate) => candidate.unit_amount === item.priceCents && candidate.currency === "brl");
    const finalPrice = price ?? await stripe.prices.create({
      product: product.id,
      unit_amount: item.priceCents,
      currency: "brl",
      metadata: { poppolItemId: item.id },
    });
    await db.update(poppolItemsTable)
      .set({ stripePriceId: finalPrice.id })
      .where(eq(poppolItemsTable.id, item.id));
  }
}

await main();