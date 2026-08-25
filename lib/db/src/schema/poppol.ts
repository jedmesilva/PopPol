import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const poppolPartiesTable = pgTable("poppol_parties", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
});

export const poppolItemsTable = pgTable("poppol_items", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  tier: integer("tier").notNull(),
  emoji: text("emoji").notNull(),
  label: text("label").notNull(),
  hint: text("hint").notNull(),
  weight: integer("weight").notNull(),
  priceCents: integer("price_cents").notNull(),
});

export const poppolPoliticiansTable = pgTable("poppol_politicians", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  role: text("role").notNull(),
  level: text("level").notNull(),
  countryCode: text("country_code").notNull(),
  countryName: text("country_name").notNull(),
  stateCode: text("state_code").notNull(),
  stateName: text("state_name").notNull(),
  city: text("city"),
  partyCode: text("party_code").notNull().references(() => poppolPartiesTable.code),
  bio: text("bio").notNull(),
  mandates: jsonb("mandates").$type<string[]>().notNull(),
  baseByItem: jsonb("base_by_item").$type<Record<string, number>>().notNull(),
});

export const poppolManifestationsTable = pgTable("poppol_manifestations", {
  id: text("id").primaryKey(),
  politicianId: text("politician_id").notNull().references(() => poppolPoliticiansTable.id),
  itemId: text("item_id").notNull().references(() => poppolItemsTable.id),
  quantity: integer("quantity").notNull(),
  note: text("note"),
  deviceTokenHash: text("device_token_hash"),
  checkoutIntentId: text("checkout_intent_id"),
  ipAddress: text("ip_address"),
  countryCode: text("country_code"),
  stateCode: text("state_code"),
  city: text("city"),
  referrer: text("referrer"),
  campaign: jsonb("campaign").$type<Record<string, string>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const poppolCheckoutIntentsTable = pgTable("poppol_checkout_intents", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  deviceTokenHash: text("device_token_hash").notNull(),
  politicianId: text("politician_id").notNull().references(() => poppolPoliticiansTable.id),
  lineItems: jsonb("line_items").$type<Array<{ itemId: string; quantity: number; priceCents: number }>>().notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"),
  providerSessionId: text("provider_session_id"),
  ipAddress: text("ip_address"),
  countryCode: text("country_code"),
  stateCode: text("state_code"),
  city: text("city"),
  referrer: text("referrer"),
  campaign: jsonb("campaign").$type<Record<string, string>>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPoppolPartySchema = createInsertSchema(poppolPartiesTable);
export const insertPoppolItemSchema = createInsertSchema(poppolItemsTable);
export const insertPoppolPoliticianSchema = createInsertSchema(poppolPoliticiansTable);
export const insertPoppolManifestationSchema = createInsertSchema(poppolManifestationsTable);

export type PoppolParty = z.infer<typeof insertPoppolPartySchema>;
export type PoppolItem = z.infer<typeof insertPoppolItemSchema>;
export type PoppolPolitician = z.infer<typeof insertPoppolPoliticianSchema>;
export type PoppolManifestation = z.infer<typeof insertPoppolManifestationSchema>;
export const insertPoppolCheckoutIntentSchema = createInsertSchema(poppolCheckoutIntentsTable);
export type PoppolCheckoutIntent = z.infer<typeof insertPoppolCheckoutIntentSchema>;