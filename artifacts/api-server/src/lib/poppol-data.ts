import { db, poppolItemsTable, poppolPartiesTable, poppolPoliticiansTable } from "@workspace/db";

const parties = [
  { code: "PVC", name: "Partido Verde Cívico", color: "#4ADE80" },
  { code: "AUP", name: "Aliança da União Popular", color: "#F97316" },
  { code: "MRN", name: "Movimento Renovação", color: "#38BDF8" },
  { code: "FDT", name: "Frente Democrática", color: "#F472B6" },
  { code: "CNP", name: "Congresso Nacional Popular", color: "#A78BFA" },
];

const items = [
  { id: "aceno", type: "apoio", tier: 0, emoji: "👋", label: "Aceno", hint: "reconhecimento leve", weight: 1, priceCents: 100 },
  { id: "aplausos", type: "apoio", tier: 1, emoji: "👏", label: "Aplausos", hint: "aprovação", weight: 4, priceCents: 400 },
  { id: "trofeu", type: "apoio", tier: 2, emoji: "🏆", label: "Troféu", hint: "destaque", weight: 12, priceCents: 1200 },
  { id: "selo", type: "apoio", tier: 3, emoji: "⭐", label: "Selo de confiança", hint: "apoio forte", weight: 30, priceCents: 3000 },
  { id: "testa_franzida", type: "critica", tier: 0, emoji: "😒", label: "Testa franzida", hint: "insatisfação leve", weight: 1, priceCents: 100 },
  { id: "tomate", type: "critica", tier: 1, emoji: "🍅", label: "Tomate", hint: "crítica", weight: 4, priceCents: 400 },
  { id: "cartao_vermelho", type: "critica", tier: 2, emoji: "🟥", label: "Cartão vermelho", hint: "reprovação", weight: 12, priceCents: 1200 },
  { id: "repudio", type: "critica", tier: 3, emoji: "🚫", label: "Repúdio", hint: "rejeição forte", weight: 30, priceCents: 3000 },
];

const politicians = [
  ["0-Marina-Andrade", "Marina Andrade", "MA", "Senadora", "federal", "BR", "Brasil", "SP", "São Paulo", null, "PVC", "Defende transparência no orçamento e transição energética com foco em empregos locais.", ["Comissão de Meio Ambiente", "Frente pela Transparência"], { aceno: 102, aplausos: 62, trofeu: 24, selo: 8, testa_franzida: 18, tomate: 9, cartao_vermelho: 3, repudio: 1 }],
  ["1-Heitor-Bittencourt", "Heitor Bittencourt", "HB", "Governador", "estadual", "BR", "Brasil", "RJ", "Rio de Janeiro", null, "AUP", "Entre segurança e desenvolvimento, apresenta resultados mistos no primeiro ano de mandato.", ["Plano de Segurança", "Programa Primeiro Emprego"], { aceno: 71, aplausos: 35, trofeu: 8, selo: 2, testa_franzida: 46, tomate: 25, cartao_vermelho: 12, repudio: 4 }],
  ["2-Beatriz-Cavalcante", "Beatriz Cavalcante", "BC", "Prefeita", "municipal", "BR", "Brasil", "PR", "Paraná", "Curitiba", "MRN", "Gestão voltada para clima, zeladoria e qualidade de vida nos bairros.", ["Pacto pelo Clima", "Plano de Calçadas"], { aceno: 65, aplausos: 42, trofeu: 14, selo: 4, testa_franzida: 28, tomate: 12, cartao_vermelho: 4, repudio: 1 }],
  ["3-Rogério-Duarte", "Rogério Duarte", "RD", "Deputado Federal", "federal", "BR", "Brasil", "MG", "Minas Gerais", null, "FDT", "Atua em mobilidade urbana e fortalecimento de serviços públicos nas cidades médias.", ["Comissão de Viação", "Bancada Municipalista"], { aceno: 53, aplausos: 31, trofeu: 11, selo: 3, testa_franzida: 22, tomate: 15, cartao_vermelho: 8, repudio: 2 }],
  ["4-Cecília-Esteves", "Cecília Esteves", "CE", "Vereadora", "municipal", "BR", "Brasil", "BA", "Bahia", "Salvador", "PVC", "Representa pautas de cultura, primeira infância e ocupação dos espaços públicos.", ["Conselho de Cultura", "Bairro Vivo"], { aceno: 44, aplausos: 26, trofeu: 6, selo: 1, testa_franzida: 18, tomate: 14, cartao_vermelho: 7, repudio: 3 }],
  ["5-Otávio-Farias", "Otávio Farias", "OF", "Deputado Estadual", "estadual", "BR", "Brasil", "RS", "Rio Grande do Sul", null, "CNP", "Atuação concentrada em orçamento regional e resposta a emergências.", ["Frente de Reconstrução", "Defesa Civil"], { aceno: 31, aplausos: 18, trofeu: 4, selo: 1, testa_franzida: 27, tomate: 21, cartao_vermelho: 11, repudio: 5 }],
];

let seedPromise: Promise<void> | undefined;

export function ensurePoppolSeeded(): Promise<void> {
  seedPromise ??= (async () => {
    const existing = await db.select({ id: poppolItemsTable.id }).from(poppolItemsTable).limit(1);
    if (existing.length > 0) return;
    await db.insert(poppolPartiesTable).values(parties).onConflictDoNothing();
    await db.insert(poppolItemsTable).values(items).onConflictDoNothing();
    await db.insert(poppolPoliticiansTable).values(
      politicians.map(([id, name, initials, role, level, countryCode, countryName, stateCode, stateName, city, partyCode, bio, mandates, baseByItem]) => ({
        id: id as string, name: name as string, initials: initials as string, role: role as string, level: level as string,
        countryCode: countryCode as string, countryName: countryName as string, stateCode: stateCode as string, stateName: stateName as string,
        city: city as string | null, partyCode: partyCode as string, bio: bio as string, mandates: mandates as string[], baseByItem: baseByItem as Record<string, number>,
      })),
    ).onConflictDoNothing();
  })();
  return seedPromise;
}