import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, poppolItemsTable, poppolManifestationsTable, poppolPartiesTable, poppolPoliticiansTable } from "@workspace/db";
import {
  CreateManifestationBody, CreateManifestationParams, CreateManifestationResponse, GetPoliticianParams,
  GetPoliticianResponse, ListActivityResponse, ListPoliticiansQueryParams, ListPoliticiansResponse,
} from "@workspace/api-zod";
import { ensurePoppolSeeded } from "../lib/poppol-data";
import { getRequestContext } from "../lib/request-context";
import { publishPoppolAction } from "../lib/action-events";

type Item = typeof poppolItemsTable.$inferSelect;
type Manifestation = typeof poppolManifestationsTable.$inferSelect;

const router: IRouter = Router();

function serializeItem(item: Item) {
  return { id: item.id, label: item.label, kind: item.type === "apoio" ? "apoio" : "critica", weight: item.weight, tier: item.tier, emoji: item.emoji, hint: item.hint, priceCents: item.priceCents };
}

function summarize(politician: typeof poppolPoliticiansTable.$inferSelect, party: typeof poppolPartiesTable.$inferSelect, items: Item[], manifestations: Manifestation[]) {
  const counts = { ...(politician.baseByItem ?? {}) } as Record<string, number>;
  for (const manifestation of manifestations) counts[manifestation.itemId] = (counts[manifestation.itemId] ?? 0) + manifestation.quantity;
  let support = 0, criticism = 0;
  for (const item of items) {
    const value = (counts[item.id] ?? 0) * item.weight;
    if (item.type === "apoio") support += value;
    else criticism += value;
  }
  return {
    id: politician.id, name: politician.name, initials: politician.initials, role: politician.role, level: politician.level,
    countryCode: politician.countryCode, countryName: politician.countryName, stateCode: politician.stateCode, stateName: politician.stateName,
    city: politician.city, region: politician.city ? `${politician.city}, ${politician.stateName}` : politician.stateName,
    party: { code: party.code, name: party.name, color: party.color }, score: support - criticism, support, criticism,
    trend: 0, position: 0, baseByItem: counts, bio: politician.bio, mandates: politician.mandates, items: items.map(serializeItem),
  };
}

async function loadData() {
  await ensurePoppolSeeded();
  const [politicians, parties, items, manifestations] = await Promise.all([
    db.select().from(poppolPoliticiansTable),
    db.select().from(poppolPartiesTable),
    db.select().from(poppolItemsTable),
    db.select().from(poppolManifestationsTable).orderBy(desc(poppolManifestationsTable.createdAt)),
  ]);
  return { politicians, parties, items, manifestations };
}

router.get("/politicians", async (req, res): Promise<void> => {
  const parsed = ListPoliticiansQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { politicians, parties, items, manifestations } = await loadData();
  const partyMap = new Map(parties.map((party) => [party.code, party]));
  let result = politicians.map((politician) => summarize(politician, partyMap.get(politician.partyCode)!, items, manifestations.filter((entry) => entry.politicianId === politician.id)));
  const query = parsed.data;
  if (query.q) {
    const q = query.q.toLowerCase();
    result = result.filter((p) => `${p.name} ${p.role} ${p.region} ${p.party.name}`.toLowerCase().includes(q));
  }
  if (query.level) result = result.filter((p) => p.level === query.level);
  if (query.region) {
    const regionQuery = query.region.toLowerCase();
    result = result.filter((p) => `${p.region} ${p.countryName}`.toLowerCase().includes(regionQuery));
  }
  if (query.country) result = result.filter((p) => p.countryCode === query.country);
  if (query.state) result = result.filter((p) => p.stateCode === query.state);
  if (query.city) result = result.filter((p) => p.city === query.city);
  result.sort((a, b) => query.sort === "apoio" ? b.support - a.support : query.sort === "critica" ? b.criticism - a.criticism : b.score - a.score);
  result.forEach((p, index) => { p.position = index + 1; });
  res.json(ListPoliticiansResponse.parse(result));
});

router.get("/politicians/:id", async (req, res): Promise<void> => {
  const params = GetPoliticianParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { politicians, parties, items, manifestations } = await loadData();
  const politician = politicians.find((entry) => entry.id === params.data.id);
  if (!politician) { res.status(404).json({ error: "Político não encontrado" }); return; }
  const party = parties.find((entry) => entry.code === politician.partyCode)!;
  const summary = summarize(politician, party, items, manifestations.filter((entry) => entry.politicianId === politician.id));
  const recentActivity = manifestations.filter((entry) => entry.politicianId === politician.id).slice(0, 10).map((entry) => {
    const item = items.find((candidate) => candidate.id === entry.itemId)!;
    return { id: entry.id, politicianId: politician.id, politicianName: politician.name, itemLabel: item.label, kind: item.type === "apoio" ? "apoio" : "critica", createdAt: entry.createdAt, region: summary.region };
  });
  res.json(GetPoliticianResponse.parse({ ...summary, recentActivity }));
});

router.post("/politicians/:id/manifestations", async (req, res): Promise<void> => {
  const params = CreateManifestationParams.safeParse(req.params);
  const body = CreateManifestationBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Manifestação inválida" }); return; }
  await ensurePoppolSeeded();
  const [politician] = await db.select().from(poppolPoliticiansTable).where(eq(poppolPoliticiansTable.id, params.data.id));
  const [item] = await db.select().from(poppolItemsTable).where(eq(poppolItemsTable.id, body.data.itemId));
  if (!politician || !item) { res.status(404).json({ error: "Político ou item não encontrado" }); return; }
  const quantity = body.data.quantity ?? 1;
  const [created] = await db.insert(poppolManifestationsTable).values({
    id: `manifestation-${crypto.randomUUID()}`,
    politicianId: politician.id,
    itemId: item.id,
    quantity,
    note: body.data.note ?? null,
    ...getRequestContext(req, res),
  }).returning();
  publishPoppolAction({
    id: created.id,
    politicianId: created.politicianId,
    itemId: created.itemId,
    quantity: created.quantity,
    createdAt: created.createdAt.toISOString(),
  });
  res.status(201).json(CreateManifestationResponse.parse({ id: created.id, politicianId: created.politicianId, item: serializeItem(item), quantity: created.quantity, createdAt: created.createdAt, note: created.note }));
});

router.get("/activity", async (_req, res): Promise<void> => {
  const { politicians, items, manifestations } = await loadData();
  const politicianMap = new Map(politicians.map((p) => [p.id, p]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const activity = manifestations.slice(0, 10).map((entry) => {
    const politician = politicianMap.get(entry.politicianId)!; const item = itemMap.get(entry.itemId)!;
    return { id: entry.id, politicianId: politician.id, politicianName: politician.name, itemLabel: item.label, kind: item.type === "apoio" ? "apoio" : "critica", createdAt: entry.createdAt, region: politician.city ? `${politician.city}, ${politician.stateName}` : politician.stateName };
  });
  res.json(ListActivityResponse.parse(activity));
});

router.get("/stats/overview", async (_req, res): Promise<void> => {
  const { politicians, items, manifestations } = await loadData();
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const support = manifestations.reduce((sum, entry) => sum + (itemMap.get(entry.itemId)?.type === "apoio" ? entry.quantity : 0), 0);
  const criticism = manifestations.reduce((sum, entry) => sum + (itemMap.get(entry.itemId)?.type === "critica" ? entry.quantity : 0), 0);
  const regions = new Set(politicians.map((p) => `${p.countryCode}:${p.stateCode}`));
  res.json({ totalPoliticians: politicians.length, totalManifestations: manifestations.reduce((sum, entry) => sum + entry.quantity, 0), activeRegions: regions.size, supportPercentage: support + criticism > 0 ? Math.round((support / (support + criticism)) * 100) : 50 });
});

export default router;