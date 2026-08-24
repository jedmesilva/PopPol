import { Router, type IRouter } from "express";
import {
  CreateManifestationBody,
  CreateManifestationParams,
  CreateManifestationResponse,
  GetPoliticianParams,
  GetPoliticianResponse,
  ListActivityResponse,
  ListPoliticiansQueryParams,
  ListPoliticiansResponse,
} from "@workspace/api-zod";

type Kind = "apoio" | "critica";

type Party = { code: string; name: string; color: string };
type Item = { id: string; label: string; kind: Kind; weight: number };
type Politician = {
  id: string;
  name: string;
  initials: string;
  role: string;
  level: string;
  region: string;
  party: Party;
  score: number;
  support: number;
  criticism: number;
  trend: number;
  position: number;
  bio: string;
  mandates: string[];
  items: Item[];
};

const parties: Party[] = [
  { code: "PV", name: "Partido Verde", color: "#8ecb6d" },
  { code: "C", name: "Cidadania", color: "#e78c58" },
  { code: "PS", name: "Partido Social", color: "#c97aa5" },
  { code: "R", name: "Renova", color: "#6ca7c9" },
];

const items: Item[] = [
  { id: "aceno", label: "Aceno", kind: "apoio", weight: 1 },
  { id: "aplausos", label: "Aplausos", kind: "apoio", weight: 4 },
  { id: "confianca", label: "Voto de confiança", kind: "apoio", weight: 12 },
  { id: "franzida", label: "Testa franzida", kind: "critica", weight: 1 },
  { id: "critica", label: "Crítica", kind: "critica", weight: 4 },
  { id: "repudio", label: "Repúdio", kind: "critica", weight: 12 },
];

const politicians: Politician[] = [
  ["ana", "Ana Bezerra", "AB", "Senadora", "federal", "São Paulo", parties[0], 92, 74, 22, 8, "Defende transparência no orçamento e transição energética com foco em empregos locais.", ["Comissão de Meio Ambiente", "Frente pela Transparência"], 185, 41],
  ["caio", "Caio Nogueira", "CN", "Deputado Federal", "federal", "Minas Gerais", parties[1], 76, 58, 29, 4, "Atua em mobilidade urbana e fortalecimento de serviços públicos nas cidades médias.", ["Comissão de Viação", "Bancada Municipalista"], 120, 48],
  ["luiza", "Luiza Martins", "LM", "Prefeita", "municipal", "Curitiba, PR", parties[3], 68, 63, 38, -3, "Gestão voltada para clima, zeladoria e qualidade de vida nos bairros.", ["Pacto pelo Clima", "Plano de Calçadas"], 98, 44],
  ["heitor", "Heitor Campos", "HC", "Governador", "estadual", "Rio de Janeiro", parties[2], 54, 39, 51, -6, "Entre segurança e desenvolvimento, apresenta resultados mistos no primeiro ano de mandato.", ["Plano de Segurança", "Programa Primeiro Emprego"], 72, 51],
  ["marina", "Marina Duarte", "MD", "Vereadora", "municipal", "Salvador, BA", parties[0], 47, 52, 36, 10, "Representa pautas de cultura, primeira infância e ocupação dos espaços públicos.", ["Conselho de Cultura", "Bairro Vivo"], 66, 39],
  ["bruno", "Bruno Farias", "BF", "Deputado Estadual", "estadual", "Porto Alegre, RS", parties[1], 39, 35, 49, -2, "Atuação concentrada em orçamento regional e resposta a emergências.", ["Frente de Reconstrução", "Defesa Civil"], 51, 46],
].map(([id, name, initials, role, level, region, party, score, support, criticism, trend, bio, mandates, supportCount, criticismCount]) => ({
  id: id as string,
  name: name as string,
  initials: initials as string,
  role: role as string,
  level: level as string,
  region: region as string,
  party: party as Party,
  score: score as number,
  support: support as number,
  criticism: criticism as number,
  trend: trend as number,
  position: 0,
  bio: bio as string,
  mandates: mandates as string[],
  items,
  supportCount: supportCount as number,
  criticismCount: criticismCount as number,
})) as Politician[];

politicians.forEach((politician, index) => { politician.position = index + 1; });

const activity = [
  ["ana", "Ana Bezerra", "Aplausos", "apoio", "São Paulo"],
  ["luiza", "Luiza Martins", "Voto de confiança", "apoio", "Curitiba, PR"],
  ["heitor", "Heitor Campos", "Crítica", "critica", "Rio de Janeiro"],
  ["marina", "Marina Duarte", "Aceno", "apoio", "Salvador, BA"],
  ["caio", "Caio Nogueira", "Testa franzida", "critica", "Minas Gerais"],
].map(([politicianId, politicianName, itemLabel, kind, region], index) => ({
  id: `activity-${index + 1}`,
  politicianId,
  politicianName,
  itemLabel,
  kind: kind as Kind,
  createdAt: new Date(Date.now() - index * 1000 * 60 * 19).toISOString(),
  region,
}));

const router: IRouter = Router();

router.get("/politicians", (req, res) => {
  const parsed = ListPoliticiansQueryParams.safeParse(req.query);
  const query = parsed.success ? parsed.data : {};
  let result = [...politicians];
  if (query.q) {
    const q = query.q.toLowerCase();
    result = result.filter((p) => `${p.name} ${p.role} ${p.region} ${p.party.name}`.toLowerCase().includes(q));
  }
  if (query.level) result = result.filter((p) => p.level === query.level);
  if (query.region) result = result.filter((p) => p.region.toLowerCase().includes(query.region!.toLowerCase()));
  if (query.sort === "apoio") result.sort((a, b) => b.support - a.support);
  if (query.sort === "critica") result.sort((a, b) => b.criticism - a.criticism);
  else if (!query.sort || query.sort === "relevancia") result.sort((a, b) => b.score - a.score);
  res.json(ListPoliticiansResponse.parse(result));
});

router.get("/politicians/:id", (req, res) => {
  const parsed = GetPoliticianParams.safeParse(req.params);
  const politician = parsed.success ? politicians.find((p) => p.id === parsed.data.id) : undefined;
  if (!politician) { res.status(404).json({ error: "Político não encontrado" }); return; }
  res.json(GetPoliticianResponse.parse({ ...politician, recentActivity: activity.filter((a) => a.politicianId === politician.id) }));
});

router.post("/politicians/:id/manifestations", (req, res) => {
  const params = CreateManifestationParams.safeParse(req.params);
  const body = CreateManifestationBody.safeParse(req.body);
  const politician = params.success ? politicians.find((p) => p.id === params.data.id) : undefined;
  const item = body.success ? items.find((candidate) => candidate.id === body.data.itemId) : undefined;
  if (!politician || !body.success || !item) { res.status(400).json({ error: "Manifestação inválida" }); return; }
  if (item.kind === "apoio") politician.support += item.weight;
  else politician.criticism += item.weight;
  politician.score = politician.support - politician.criticism;
  const result = { id: `manifestation-${Date.now()}`, politicianId: politician.id, item, createdAt: new Date().toISOString(), note: body.data.note ?? null };
  activity.unshift({ id: result.id, politicianId: politician.id, politicianName: politician.name, itemLabel: item.label, kind: item.kind, createdAt: result.createdAt, region: politician.region });
  res.status(201).json(CreateManifestationResponse.parse(result));
});

router.get("/activity", (_req, res) => res.json(ListActivityResponse.parse(activity.slice(0, 10))));
router.get("/stats/overview", (_req, res) => res.json({ totalPoliticians: politicians.length, totalManifestations: 1842, activeRegions: 18, supportPercentage: 61 }));

export default router;