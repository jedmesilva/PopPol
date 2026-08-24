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