import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Search, MapPin, X, SlidersHorizontal, ChevronDown, Share2, ShoppingBag, ArrowLeft, CreditCard, Minus, Plus, Loader2, Trash2, LayoutGrid, TrendingUp, TrendingDown } from "lucide-react";

/* ------------------------------------------------------------------
   PopPol — Popularidade Política — Grid dominante (treemap)
   Ocupa 100% da viewport, sem scroll. O espaço de cada político é
   proporcional ao SALDO de relevância que ele recebeu dos usuários:
   itens de APOIO somam, itens de CRÍTICA subtraem — e cada item tem
   um peso próprio (um "aceno" pesa pouco, um "repúdio" pesa muito),
   pra representar que às vezes as pessoas só estão um pouco
   incomodadas, e às vezes odeiam mesmo. Quanto maior o saldo, maior
   a célula; quanto mais negativo, menor (nunca desaparece de vez).
   Pra enviar, o usuário monta uma sacola com os itens e quantidades
   que quiser (de qualquer um dos dois lados), avança pra um checkout
   com o valor total e o efeito na relevância, e só ao "pagar"
   (Pix/cartão simulado) os itens são enviados ao político.

   Dados FICTÍCIOS (países, estados, cidades, nomes), só para ilustrar
   a interface e a estrutura de filtro.
------------------------------------------------------------------- */

const PARTIES = [
  { code: "PVC", name: "Partido Verde Cívico", color: "#4ADE80" },
  { code: "AUP", name: "Aliança da União Popular", color: "#F97316" },
  { code: "MRN", name: "Movimento Renovação", color: "#38BDF8" },
  { code: "FDT", name: "Frente Democrática", color: "#F472B6" },
  { code: "CNP", name: "Congresso Nacional Popular", color: "#A78BFA" },
];

const FIRST = ["Marina", "Heitor", "Beatriz", "Rogério", "Cecília", "Otávio", "Luiza", "Fábio", "Aline", "Renato", "Débora", "Ivo", "Camila", "Nélson", "Sofia", "Bruno", "Talita", "Gustavo", "Priscila", "Edmar", "Yasmin", "Caio", "Lorena", "Mateus"];
const LAST = ["Andrade", "Bittencourt", "Cavalcante", "Duarte", "Esteves", "Farias", "Guimarães", "Holanda", "Junqueira", "Lacerda", "Machado", "Nogueira", "Oliveira", "Prado", "Queiroz", "Siqueira", "Teixeira", "Ramalho"];

const ROLES_BY_LEVEL = {
  municipal: ["Vereador", "Vereadora", "Prefeito", "Prefeita"],
  estadual: ["Deputado Estadual", "Deputada Estadual", "Governador", "Governadora"],
  federal: ["Deputado Federal", "Deputada Federal", "Senador", "Senadora"],
};
const LEVELS = ["federal", "estadual", "municipal"];
const LEVEL_LABEL = { federal: "Federal", estadual: "Estadual", municipal: "Municipal" };


// Metadados de cada lado da balança. "sign" é o multiplicador aplicado
// ao peso do item na hora de somar ao saldo de relevância.
const TYPE_META = {
  apoio: { label: "Apoio", verb: "Apoiar", color: "#4ADE80", soft: "#4ADE8020", sign: 1 },
  rejeicao: { label: "Crítica", verb: "Criticar", color: "#E2555F", soft: "#E2555F20", sign: -1 },
};

// Catálogo de itens. Cada item tem um "value" (peso) — itens leves
// custam pouco e pesam pouco no saldo (uma testa franzida não é
// ódio); itens fortes custam mais e pesam muito (um repúdio é uma
// declaração pesada). Preço em centavos (capital sempre em centavos).
const ITEMS = [
  { id: "aceno", type: "apoio", tier: 0, emoji: "👋", label: "Aceno", hint: "reconhecimento leve", value: 1, priceCents: 100 },
  { id: "aplausos", type: "apoio", tier: 1, emoji: "👏", label: "Aplausos", hint: "aprovação", value: 4, priceCents: 400 },
  { id: "trofeu", type: "apoio", tier: 2, emoji: "🏆", label: "Troféu", hint: "destaque", value: 12, priceCents: 1200 },
  { id: "selo", type: "apoio", tier: 3, emoji: "⭐", label: "Selo de confiança", hint: "apoio forte", value: 30, priceCents: 3000 },
  { id: "testa_franzida", type: "rejeicao", tier: 0, emoji: "😒", label: "Testa franzida", hint: "insatisfação leve", value: 1, priceCents: 100 },
  { id: "tomate", type: "rejeicao", tier: 1, emoji: "🍅", label: "Tomate", hint: "crítica", value: 4, priceCents: 400 },
  { id: "cartao_vermelho", type: "rejeicao", tier: 2, emoji: "🟥", label: "Cartão vermelho", hint: "reprovação", value: 12, priceCents: 1200 },
  { id: "repudio", type: "rejeicao", tier: 3, emoji: "🚫", label: "Repúdio", hint: "rejeição forte", value: 30, priceCents: 3000 },
];
const APOIO_ITEMS = ITEMS.filter((it) => it.type === "apoio");
const REJEICAO_ITEMS = ITEMS.filter((it) => it.type === "rejeicao");
// Lista única, com itens dos dois lados intercalados por tier — é o
// que aparece na interface pro usuário, sem separar por rótulo.
const MIXED_ITEMS = [0, 1, 2, 3].flatMap((tier) => [
  APOIO_ITEMS.find((it) => it.tier === tier),
  REJEICAO_ITEMS.find((it) => it.tier === tier),
]);
// Categorias neutras (por raridade/tier) usadas no catálogo completo —
// cada categoria mistura itens dos dois lados, sem nomear "apoio" ou
// "crítica" em lugar nenhum da interface.
const CATEGORY_LABELS = ["Itens do dia a dia", "Itens populares", "Itens de destaque", "Itens raros"];
// Pesos usados só pra gerar a distribuição inicial (fictícia) de itens
// já recebidos por cada político — na mesma ordem de cada lista acima,
// itens leves aparecem com muito mais frequência que os pesados.
const TIER_BASE_WEIGHTS = [40, 25, 10, 4];
const MIN_CELL_VALUE = 20; // piso pro político nunca sumir do mapa, mesmo com saldo bem negativo

// Estrutura hierárquica de local — País > Estado/Região > Cidade.
const GEO = {
  BR: {
    name: "Brasil",
    states: {
      SP: { name: "São Paulo", cities: ["São Paulo", "Campinas", "Santos"] },
      RJ: { name: "Rio de Janeiro", cities: ["Rio de Janeiro", "Niterói"] },
      MG: { name: "Minas Gerais", cities: ["Belo Horizonte", "Uberlândia"] },
      PR: { name: "Paraná", cities: ["Curitiba", "Londrina"] },
      RS: { name: "Rio Grande do Sul", cities: ["Porto Alegre", "Caxias do Sul"] },
      BA: { name: "Bahia", cities: ["Salvador", "Feira de Santana"] },
    },
  },
  PT: {
    name: "Portugal",
    states: {
      LIS: { name: "Lisboa", cities: ["Lisboa", "Sintra", "Cascais"] },
      PRT: { name: "Porto", cities: ["Porto", "Braga"] },
    },
  },
  AR: {
    name: "Argentina",
    states: {
      BSA: { name: "Buenos Aires", cities: ["Buenos Aires", "La Plata"] },
      COR: { name: "Córdoba", cities: ["Córdoba", "Villa María"] },
    },
  },
};
const COUNTRY_CODES = Object.keys(GEO);

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
function pick(rnd, arr) {
  return arr[Math.floor(rnd() * arr.length)];
}
function hashSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}
function sumValues(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + b, 0);
}

// Saldo de relevância: soma o peso de cada item de apoio e subtrai o
// peso de cada item de crítica. É esse número que decide o tamanho
// da célula no mapa (com um piso mínimo pra nunca sumir de vez).
function netScoreOf(byItem) {
  let s = 0;
  for (const it of ITEMS) {
    const qty = byItem?.[it.id] || 0;
    s += TYPE_META[it.type].sign * it.value * qty;
  }
  return s;
}
// Totais "brutos" (sem cancelar um lado com o outro) — usado pra
// desenhar a barra de aprovação e as prateleiras do modal.
function weightedTotalsOf(byItem) {
  let apoio = 0,
    rejeicao = 0;
  for (const it of ITEMS) {
    const qty = byItem?.[it.id] || 0;
    if (it.type === "apoio") apoio += it.value * qty;
    else rejeicao += it.value * qty;
  }
  return { apoio, rejeicao };
}

// Distribui um total de itens "já recebidos" entre os itens de uma
// lista (só apoio ou só rejeição), respeitando pesos de raridade
// (itens leves são mais comuns) com jitter por político.
function distributeBase(rnd, total, items) {
  const jittered = items.map((_, i) => (TIER_BASE_WEIGHTS[i] ?? 1) * (0.65 + rnd() * 0.7));
  const sumW = jittered.reduce((a, b) => a + b, 0) || 1;
  const dist = {};
  items.forEach((item, i) => {
    dist[item.id] = Math.max(0, Math.round((jittered[i] / sumW) * total));
  });
  return dist;
}

function buildPoliticians(count = 26) {
  const rnd = seededRandom(11);
  const list = [];
  for (let i = 0; i < count; i++) {
    const first = pick(rnd, FIRST);
    const last = pick(rnd, LAST);
    const party = pick(rnd, PARTIES);
    const level = pick(rnd, LEVELS);
    const role = pick(rnd, ROLES_BY_LEVEL[level]);

    const countryCode = pick(rnd, COUNTRY_CODES);
    const country = GEO[countryCode];
    const stateCodes = Object.keys(country.states);
    const stateCode = pick(rnd, stateCodes);
    const state = country.states[stateCode];
    const city = level === "municipal" ? pick(rnd, state.cities) : null;

    // totalAttention = quantos itens (dos dois lados, somados) esse
    // político já recebeu antes do usuário interagir. "leaning" decide
    // se a maior parte disso foi apoio ou crítica — puxado levemente
    // pros extremos, pra ter tanto queridinhos quanto rejeitados.
    const raw = Math.pow(rnd(), 2.3);
    const totalAttention = Math.round(6 + raw * 860);
    const leanRaw = rnd() * 2 - 1;
    const leaning = Math.sign(leanRaw) * Math.pow(Math.abs(leanRaw), 0.75);
    const apoioShare = (leaning + 1) / 2;
    const apoioTotal = Math.round(totalAttention * apoioShare);
    const rejeicaoTotal = totalAttention - apoioTotal;

    const baseByItem = {
      ...distributeBase(rnd, apoioTotal, APOIO_ITEMS),
      ...distributeBase(rnd, rejeicaoTotal, REJEICAO_ITEMS),
    };

    list.push({
      id: `${i}-${first}-${last}`,
      name: `${first} ${last}`,
      role,
      level,
      countryCode,
      countryName: country.name,
      stateCode,
      stateName: state.name,
      city,
      party,
      baseByItem,
      initials: `${first[0]}${last[0]}`,
    });
  }
  return list;
}

function locationLabel(p) {
  if (p.level === "municipal") return `${p.city}, ${p.stateName} — ${p.countryName}`;
  return `${p.stateName} — ${p.countryName}`;
}

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}mil`;
  return `${n}`;
}
// Como formatCount, mas com sinal — pra saldo de relevância, que pode
// ser negativo (mais crítica que apoio).
function formatScore(n) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return `${sign}${formatCount(abs)}`;
}
// Efeito de um item na popularidade, em forma de sigla de jogo — mais
// claro que um número com sinal solto (evita parecer erro de preço).
function formatEffect(item) {
  return `${TYPE_META[item.type].sign > 0 ? "DEF" : "ATQ"} ${item.value}`;
}

function formatBRL(cents) {
  const value = (cents / 100).toFixed(2).replace(".", ",");
  const [intPart, decPart] = value.split(",");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${withThousands},${decPart}`;
}

const AVATAR_BG = ["F59E0B", "38BDF8", "4ADE80", "F472B6", "A78BFA", "FB7185", "22D3EE", "FBBF24"];
function avatarBg(seed) {
  return AVATAR_BG[hashSeed(seed) % AVATAR_BG.length];
}
function avatarDataUri(seed, initials) {
  const bg = avatarBg(seed);
  const h = hashSeed(seed);
  const shift = 60 + (h % 30);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#${bg}"/>
      <rect width="200" height="200" fill="#000000" opacity="0.08"/>
      <circle cx="100" cy="82" r="40" fill="#ffffff" opacity="0.92"/>
      <path d="M30 200 Q100 ${shift} 170 200 Z" fill="#ffffff" opacity="0.92"/>
      <text x="100" y="94" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" fill="#${bg}" text-anchor="middle">${initials}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Versão retrato (mais alta que larga), usada no cartão grande do modal
// de detalhe — o mesmo estilo das células do grid, só que "sangrando"
// para preencher todo o topo do cartão em vez de caber num círculo.
function cardPortraitDataUri(seed, initials) {
  const bg = avatarBg(seed);
  const h = hashSeed(seed);
  const shift = 70 + (h % 40);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
      <defs>
        <radialGradient id="g" cx="50%" cy="28%" r="80%">
          <stop offset="0%" stop-color="#${bg}" stop-opacity="1"/>
          <stop offset="100%" stop-color="#${bg}" stop-opacity="0.7"/>
        </radialGradient>
      </defs>
      <rect width="300" height="400" fill="url(#g)"/>
      <rect width="300" height="400" fill="#000000" opacity="0.10"/>
      <circle cx="150" cy="150" r="78" fill="#ffffff" opacity="0.92"/>
      <path d="M14 400 Q150 ${shift + 130} 286 400 Z" fill="#ffffff" opacity="0.92"/>
      <text x="150" y="165" font-family="Georgia, 'Times New Roman', serif" font-size="56" font-weight="700" fill="#${bg}" text-anchor="middle">${initials}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* --------------------- algoritmo de treemap (squarified) --------------------- */

function worstRatio(row, side) {
  const sum = row.reduce((s, r) => s + r.value, 0);
  const thickness = sum / side;
  let worst = 0;
  for (const it of row) {
    const length = it.value / thickness;
    const ratio = Math.max(thickness / length, length / thickness);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

function squarify(items, x, y, w, h) {
  const result = [];
  let remaining = items.slice();
  let rx = x,
    ry = y,
    rw = w,
    rh = h;

  while (remaining.length > 0) {
    if (rw <= 0 || rh <= 0) {
      for (const it of remaining) result.push({ item: it.item, x: rx, y: ry, w: Math.max(rw, 0), h: Math.max(rh, 0) });
      break;
    }
    const side = Math.min(rw, rh);
    let row = [remaining[0]];
    let bestRatio = worstRatio(row, side);
    let i = 1;
    while (i < remaining.length) {
      const testRow = row.concat(remaining[i]);
      const testRatio = worstRatio(testRow, side);
      if (testRatio <= bestRatio) {
        row = testRow;
        bestRatio = testRatio;
        i++;
      } else {
        break;
      }
    }

    const rowSum = row.reduce((s, r) => s + r.value, 0);
    const thickness = rowSum / side;
    let offset = 0;

    if (rw >= rh) {
      for (const it of row) {
        const itemH = (it.value / rowSum) * rh;
        result.push({ item: it.item, x: rx, y: ry + offset, w: thickness, h: itemH });
        offset += itemH;
      }
      rx += thickness;
      rw -= thickness;
    } else {
      for (const it of row) {
        const itemW = (it.value / rowSum) * rw;
        result.push({ item: it.item, x: rx + offset, y: ry, w: itemW, h: thickness });
        offset += itemW;
      }
      ry += thickness;
      rh -= thickness;
    }
    remaining = remaining.slice(row.length);
  }
  return result;
}

function computeTreemap(politicians, width, height) {
  if (!politicians.length || width <= 0 || height <= 0) return [];
  // O valor que define o tamanho de cada célula é o SALDO de
  // relevância (apoio menos crítica, ponderado pelo peso de cada
  // item), nunca abaixo de um piso mínimo — só pra continuar visível.
  const sorted = [...politicians].sort((a, b) => b.netScore - a.netScore);
  const total = sorted.reduce((s, p) => s + Math.max(p.netScore, MIN_CELL_VALUE), 0);
  const area = width * height;
  const scale = area / total;
  const items = sorted.map((p) => ({ item: p, value: Math.max(Math.max(p.netScore, MIN_CELL_VALUE) * scale, 1) }));
  return squarify(items, 0, 0, width, height);
}

/* --------------------------------- UI --------------------------------- */

function TreemapCell({ rect, gap, onClick }) {
  const p = rect.item;
  const w = rect.w - gap;
  const h = rect.h - gap;
  if (w <= 0 || h <= 0) return null;

  const scaleFactor = Math.min(1.6, Math.max(0.5, Math.sqrt(w * h) / 200));
  const dominant = w > 240 && h > 190;
  const tooSmall = w < 56 || h < 56;
  const sentimentColor = p.netScore >= 0 ? TYPE_META.apoio.color : TYPE_META.rejeicao.color;

  return (
    <button
      onClick={onClick}
      title={`${p.name} — ${p.role} — saldo ${formatScore(p.netScore)}`}
      style={{
        position: "absolute",
        left: rect.x + gap / 2,
        top: rect.y + gap / 2,
        width: w,
        height: h,
        borderRadius: 0,
        overflow: "hidden",
        cursor: "pointer",
        padding: 0,
        border: "none",
        boxSizing: "border-box",
        boxShadow: dominant ? "0 12px 40px rgba(0,0,0,0.45)" : "none",
      }}
    >
      <img
        src={avatarDataUri(p.id, p.initials)}
        alt={p.name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {!tooSmall && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            padding: dominant ? "20px 20px" : "10px 12px",
            background: dominant
              ? "linear-gradient(180deg, rgba(0,0,0,0) 32%, rgba(0,0,0,0.82) 100%)"
              : "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.78) 100%)",
            pointerEvents: "none",
          }}
        >
          <div style={{ textAlign: "left", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  lineHeight: 1.15,
                  fontSize: Math.round(15 * scaleFactor),
                  marginBottom: dominant ? 2 : 0,
                  textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: w - (dominant ? 90 : 24),
                }}
              >
                {p.name}
              </div>
              {dominant && (
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    color: sentimentColor,
                    flexShrink: 0,
                    textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                  }}
                >
                  {formatScore(p.netScore)}
                </span>
              )}
            </div>
            {dominant && (
              <>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: Math.max(10, Math.round(11.5 * scaleFactor)),
                    color: "#D8D6CF",
                    marginBottom: 4,
                  }}
                >
                  {p.role} · {LEVEL_LABEL[p.level]}
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: Math.max(9, Math.round(10.5 * scaleFactor)),
                    color: "#9096A6",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <MapPin size={11} strokeWidth={2} />
                  {locationLabel(p)}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

function LevelChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 12.5,
        fontWeight: 600,
        padding: "7px 13px",
        borderRadius: 999,
        border: `1px solid ${active ? "#F5B942" : "#2A2E3A"}`,
        background: active ? "#F5B94222" : "#1F2330",
        color: active ? "#F5B942" : "#D8D6CF",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function GeoSelect({ label, value, onChange, disabled, options }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10.5,
          fontWeight: 600,
          color: "#6B7180",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            appearance: "none",
            background: disabled ? "#171922" : "#1F2330",
            border: "1px solid #2A2E3A",
            borderRadius: 10,
            padding: "10px 30px 10px 12px",
            color: disabled ? "#565B68" : "#EDEBE4",
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            outline: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            boxSizing: "border-box",
          }}
        >
          <option value="">Todos</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#6B7180",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

function FilterSheet({
  query,
  setQuery,
  country,
  setCountry,
  state,
  setState,
  city,
  setCity,
  level,
  setLevel,
  resultCount,
  onClose,
  onClear,
}) {
  const stateOptions = country
    ? Object.entries(GEO[country].states).map(([code, s]) => ({ value: code, label: s.name }))
    : [];
  const cityOptions = country && state ? GEO[country].states[state].cities.map((c) => ({ value: c, label: c })) : [];

  return (
    <div className="poppol-modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,9,13,0.72)" }} />
      <div
        className="poppol-modal poppol-filter-modal"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "#181B24",
          borderTop: "1px solid #2A2E3A",
          borderRadius: "22px 22px 0 0",
          padding: "18px 20px 26px",
          animation: "poppol-sheet-up 220ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: "#EDEBE4" }}>
            Filtros
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid #2A2E3A",
              background: "#1B1E27",
              color: "#9096A6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#1F2330",
            border: "1px solid #2A2E3A",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 20,
          }}
        >
          <Search size={15} color="#6B7180" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, cargo ou partido..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "#EDEBE4",
              fontSize: 13.5,
              fontFamily: "'Inter', sans-serif",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ background: "none", border: "none", color: "#6B7180", cursor: "pointer", display: "flex" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            color: "#9096A6",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 10,
          }}
        >
          Local
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <GeoSelect
            label="País"
            value={country}
            onChange={(v) => {
              setCountry(v);
              setState("");
              setCity("");
            }}
            disabled={false}
            options={COUNTRY_CODES.map((code) => ({ value: code, label: GEO[code].name }))}
          />
          <GeoSelect
            label="Estado"
            value={state}
            onChange={(v) => {
              setState(v);
              setCity("");
            }}
            disabled={!country}
            options={stateOptions}
          />
          <GeoSelect label="Cidade" value={city} onChange={setCity} disabled={!state} options={cityOptions} />
        </div>

        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            color: "#9096A6",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 10,
          }}
        >
          Nível
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          <LevelChip label="Todos" active={level === ""} onClick={() => setLevel("")} />
          {LEVELS.map((lv) => (
            <LevelChip key={lv} label={LEVEL_LABEL[lv]} active={level === lv} onClick={() => setLevel(lv)} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "#6B7180" }}>
            {resultCount} {resultCount === 1 ? "político encontrado" : "políticos encontrados"}
          </span>
          <button
            onClick={onClear}
            style={{
              background: "none",
              border: "none",
              color: "#F5B942",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  );
}

const stepperBtnStyle = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  border: "none",
  background: "#262A36",
  color: "#EDEBE4",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

const LONG_PRESS_MS = 420;
const MOVE_CANCEL_PX = 10;

// Gesto compartilhado: toque curto = "tap", pressionar e segurar sem
// mover além de MOVE_CANCEL_PX = "hold". Usado tanto pela bandeja
// rápida quanto pelo catálogo completo, pra manter o mesmo
// comportamento em qualquer lugar onde um item apareça.
function useTapOrHold({ disabled, onTap, onHold }) {
  const pressTimer = useRef(null);
  const pressStart = useRef({ x: 0, y: 0 });
  const longPressFired = useRef(false);
  const moved = useRef(false);

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const startPress = (e) => {
    if (disabled) return;
    const point = e.touches ? e.touches[0] : e;
    pressStart.current = { x: point.clientX, y: point.clientY };
    longPressFired.current = false;
    moved.current = false;
    clearPress();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onHold();
    }, LONG_PRESS_MS);
  };

  const movePress = (e) => {
    if (!pressTimer.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - pressStart.current.x;
    const dy = point.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      moved.current = true;
      clearPress();
    }
  };

  const endPress = () => {
    const wasLongPress = longPressFired.current;
    const wasMove = moved.current;
    clearPress();
    longPressFired.current = false;
    moved.current = false;
    if (wasLongPress || wasMove) return;
    onTap();
  };

  return { startPress, movePress, endPress, clearPress };
}

// Painel de "ajustar quantidade" — aparece ao segurar um item, tanto
// na bandeja rápida quanto no catálogo completo. Deixa confirmar uma
// quantidade exata ou remover o item da sacola, sem sair da tela atual.
function QtyAdjustBar({ item, initialQty, canRemove, onCancel, onConfirm, onRemove }) {
  const [qty, setQty] = useState(initialQty || 1);
  const meta = TYPE_META[item.type];
  return (
    <div style={{ borderTop: "1px solid #2A2E3A", background: "#14161D", padding: "14px 18px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onCancel}
          style={{ background: "none", border: "none", color: "#6B7180", cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 }}
        >
          <X size={16} />
        </button>
        <span style={{ fontSize: 24, flexShrink: 0 }}>{item.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, color: "#EDEBE4" }}>
            {item.label}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#9096A6", display: "flex", gap: 6 }}>
            <span>{formatBRL(item.priceCents)} cada</span>
            <span style={{ color: meta.color }}>{formatEffect(item)}/un.</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#1F2330", border: "1px solid #2A2E3A", borderRadius: 999, padding: 4, flexShrink: 0 }}>
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={stepperBtnStyle}>
            <Minus size={13} />
          </button>
          <span style={{ width: 26, textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: "#EDEBE4" }}>
            {qty}
          </span>
          <button onClick={() => setQty((q) => Math.min(99, q + 1))} style={stepperBtnStyle}>
            <Plus size={13} />
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {canRemove && (
          <button
            onClick={onRemove}
            style={{
              width: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              border: "1px solid #3A2A2A",
              background: "none",
              color: "#E27676",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Trash2 size={15} />
          </button>
        )}
        <button
          onClick={() => onConfirm(qty)}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 999,
            border: "none",
            background: "#F5B942",
            color: "#12141C",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {`Confirmar ${qty}× ${item.emoji} · ${formatBRL(item.priceCents * qty)}`}
        </button>
      </div>
    </div>
  );
}

// Bandeja de seleção: toque adiciona 1 unidade à sacola. Pressionar e
// segurar abre um painel pra ajustar a quantidade exata daquele item
// (ou removê-lo), sem sair da bandeja. As abas "Apoiar"/"Criticar"
// trocam qual lado do catálogo aparece na tira; "Ver todos" abre o
// catálogo completo, com os dois lados juntos. Nada é enviado ainda —
// só ao pagar no checkout é que os itens seguem pro político.
function CartTray({ politicianName, cart, onAddOne, onSetQty, cartCount, cartTotalCents, onContinue, onOpenAll }) {
  const [qtyItem, setQtyItem] = useState(null); // item em modo "ajustar quantidade"
  const [flashId, setFlashId] = useState(null);
  const flashTimer = useRef(null);

  const flash = (itemId) => {
    setFlashId(itemId);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 500);
  };

  useEffect(() => () => flashTimer.current && clearTimeout(flashTimer.current), []);

  if (qtyItem) {
    return (
      <QtyAdjustBar
        item={qtyItem}
        initialQty={cart[qtyItem.id] || 1}
        canRemove={(cart[qtyItem.id] || 0) > 0}
        onCancel={() => setQtyItem(null)}
        onConfirm={(qty) => {
          onSetQty(qtyItem.id, qty);
          setQtyItem(null);
        }}
        onRemove={() => {
          onSetQty(qtyItem.id, 0);
          setQtyItem(null);
        }}
      />
    );
  }

  return (
    <div style={{ borderTop: "1px solid #2A2E3A", background: "#14161D", flexShrink: 0 }}>
      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: "#F5B942", marginBottom: 2 }}>
          {politicianName ? `Ataque ou defenda ${politicianName}` : "Ataque ou defenda"}
        </div>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10.5,
            fontWeight: 700,
            color: "#6B7180",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Toque pra adicionar · segure pra ajustar qtd.
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 18px 14px", WebkitOverflowScrolling: "touch" }}>
        {MIXED_ITEMS.map((item, i) => (
          <TrayChip
            key={item.id}
            item={item}
            inCart={cart[item.id] || 0}
            flashing={flashId === item.id}
            suggested={i === 0 && cartCount === 0}
            onTap={() => {
              flash(item.id);
              onAddOne(item.id);
            }}
            onHold={() => setQtyItem(item)}
          />
        ))}
        <button
          onClick={onOpenAll}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            minWidth: 84,
            padding: "12px 8px 9px",
            borderRadius: 16,
            border: "1px dashed #3A3F4E",
            background: "#1B1E27",
            color: "#9096A6",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <LayoutGrid size={20} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
            Ver todos
          </span>
        </button>
      </div>

      {cartCount > 0 && (
        <div style={{ padding: "0 18px 16px" }}>
          <button
            onClick={onContinue}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "13px 14px",
              borderRadius: 999,
              border: "none",
              background: "#F5B942",
              color: "#12141C",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <ShoppingBag size={15} />
            {`Continuar · ${cartCount} ${cartCount === 1 ? "item" : "itens"} · ${formatBRL(cartTotalCents)}`}
          </button>
        </div>
      )}
    </div>
  );
}

// Chip individual da bandeja rápida — extraído à parte pra poder usar
// o hook de gesto compartilhado (useTapOrHold não pode ser chamado
// dentro de um .map, precisa estar no corpo de um componente próprio).
function TrayChip({ item, inCart, flashing, suggested, onTap, onHold }) {
  const { startPress, movePress, endPress, clearPress } = useTapOrHold({ onTap, onHold });
  const meta = TYPE_META[item.type];
  const animations = [];
  if (flashing) animations.push("poppol-pop 340ms ease");
  if (suggested) animations.push("poppol-invite-pulse 1.8s ease-in-out infinite");
  return (
    <button
      onPointerDown={startPress}
      onPointerMove={movePress}
      onPointerUp={endPress}
      onPointerLeave={clearPress}
      onPointerCancel={clearPress}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        minWidth: 84,
        padding: "12px 8px 9px",
        borderRadius: 16,
        border: inCart > 0 ? `1px solid ${meta.color}` : "1px solid #262A36",
        background: inCart > 0 ? meta.soft : "#1B1E27",
        cursor: "pointer",
        flexShrink: 0,
        touchAction: "pan-x",
        userSelect: "none",
        animation: animations.length ? animations.join(", ") : "none",
        overflow: "visible",
      }}
    >
      {inCart > 0 && (
        <span
          style={{
            position: "absolute",
            top: -7,
            right: -7,
            minWidth: 17,
            height: 17,
            borderRadius: 999,
            background: "#F5B942",
            color: "#12141C",
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
          }}
        >
          {inCart}
        </span>
      )}
      <span style={{ fontSize: 34, lineHeight: 1, marginTop: 2 }}>{item.emoji}</span>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10.5,
          fontWeight: 600,
          color: "#EDEBE4",
          textAlign: "center",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 76,
        }}
      >
        {item.label}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: meta.color }}>
        {formatEffect(item)}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: "#9096A6", marginTop: 1 }}>
        {formatBRL(item.priceCents)}
      </span>
    </button>
  );
}

// Cartão de item do catálogo completo — versão maior do TrayChip, em
// grade, com o ícone em destaque e o nome sempre visível.
function GridItemCard({ item, inCart, flashing, onTap, onHold }) {
  const { startPress, movePress, endPress, clearPress } = useTapOrHold({ onTap, onHold });
  const meta = TYPE_META[item.type];
  return (
    <button
      onPointerDown={startPress}
      onPointerMove={movePress}
      onPointerUp={endPress}
      onPointerLeave={clearPress}
      onPointerCancel={clearPress}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "18px 8px 12px",
        borderRadius: 18,
        border: inCart > 0 ? `1px solid ${meta.color}` : "1px solid #262A36",
        background: inCart > 0 ? meta.soft : "#1B1E27",
        cursor: "pointer",
        touchAction: "manipulation",
        userSelect: "none",
        animation: flashing ? "poppol-pop 340ms ease" : "none",
        overflow: "visible",
      }}
    >
      {inCart > 0 && (
        <span
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            minWidth: 19,
            height: 19,
            borderRadius: 999,
            background: "#F5B942",
            color: "#12141C",
            fontFamily: "'Inter', sans-serif",
            fontSize: 10.5,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
          }}
        >
          {inCart}
        </span>
      )}
      <span style={{ fontSize: 42, lineHeight: 1, marginTop: 2 }}>{item.emoji}</span>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: "#EDEBE4",
          textAlign: "center",
          lineHeight: 1.25,
        }}
      >
        {item.label}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: meta.color }}>
        {formatEffect(item)}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: "#9096A6", marginTop: 1 }}>
        {formatBRL(item.priceCents)}
      </span>
    </button>
  );
}

// Catálogo completo em tela cheia — pensado pra listas de itens muito
// maiores do que cabem na tira. Agrupa por lado (apoio / crítica) e
// tem busca no topo; abre por cima do modal de detalhe.
function ItemPickerSheet({ cart, onAddOne, onSetQty, onClose }) {
  const [query, setQuery] = useState("");
  const [qtyItem, setQtyItem] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const flashTimer = useRef(null);

  const flash = (itemId) => {
    setFlashId(itemId);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 500);
  };

  useEffect(() => () => flashTimer.current && clearTimeout(flashTimer.current), []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (item) => !q || item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q);
    return CATEGORY_LABELS.map((label, tier) => ({
      label,
      items: ITEMS.filter((it) => it.tier === tier && matches(it)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="poppol-modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 75, display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,9,13,0.82)" }} />
      <div
        className="poppol-modal poppol-picker-modal"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "#181B24",
          borderTop: "1px solid #2A2E3A",
          borderRadius: "24px 24px 0 0",
          overflow: "hidden",
          animation: "poppol-sheet-up 220ms ease",
        }}
      >
        <div style={{ padding: "18px 20px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: "#EDEBE4" }}>
              Todos os itens
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #2A2E3A",
                background: "#1B1E27",
                color: "#9096A6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1F2330",
              border: "1px solid #2A2E3A",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <Search size={15} color="#6B7180" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar item..."
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#EDEBE4",
                fontSize: 13.5,
                fontFamily: "'Inter', sans-serif",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{ background: "none", border: "none", color: "#6B7180", cursor: "pointer", display: "flex" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 20px 20px", WebkitOverflowScrolling: "touch" }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6B7180", fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "40px 0" }}>
              Nenhum item encontrado.
            </div>
          ) : (
            groups.map(({ label, items }) => (
              <div key={label} style={{ marginBottom: 22 }}>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9096A6",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 10,
                  }}
                >
                  {label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 12 }}>
                  {items.map((item) => (
                    <GridItemCard
                      key={item.id}
                      item={item}
                      inCart={cart[item.id] || 0}
                      flashing={flashId === item.id}
                      onTap={() => {
                        flash(item.id);
                        onAddOne(item.id);
                      }}
                      onHold={() => setQtyItem(item)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {qtyItem && (
          <QtyAdjustBar
            item={qtyItem}
            initialQty={cart[qtyItem.id] || 1}
            canRemove={(cart[qtyItem.id] || 0) > 0}
            onCancel={() => setQtyItem(null)}
            onConfirm={(qty) => {
              onSetQty(qtyItem.id, qty);
              setQtyItem(null);
            }}
            onRemove={() => {
              onSetQty(qtyItem.id, 0);
              setQtyItem(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Checkout: revisão da sacola + pagamento simulado (Pix/cartão). Só
// depois que o pagamento é "aprovado" os itens vão pro sentMap do
// político — antes disso, nada foi enviado de verdade. Mostra também
// o efeito líquido que a sacola vai ter no saldo de relevância.
function CheckoutView({ p, cart, cartEntries, cartTotalCents, previewDelta, onBack, onSetQty, onPay, paying }) {
  const deltaMeta = previewDelta >= 0 ? TYPE_META.apoio : TYPE_META.rejeicao;
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button
            onClick={onBack}
            disabled={paying}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid #2A2E3A",
              background: "#1B1E27",
              color: "#9096A6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: paying ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, fontWeight: 600, color: "#EDEBE4" }}>
              Revisar pedido
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: "#6B7180" }}>
              Itens serão enviados a {p.name}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {cartEntries.map(({ item, qty }) => {
            const meta = TYPE_META[item.type];
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#1F2330",
                  border: "1px solid #2A2E3A",
                  borderRadius: 14,
                  padding: "10px 12px",
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, color: "#EDEBE4" }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#9096A6", display: "flex", gap: 6 }}>
                    <span>{formatBRL(item.priceCents)} cada</span>
                    <span style={{ color: meta.color }}>{formatEffect(item)}/un.</span>
                  </div>
                </div>
                {!paying && (
                  <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#171922", border: "1px solid #2A2E3A", borderRadius: 999, padding: 3, flexShrink: 0 }}>
                    <button onClick={() => onSetQty(item.id, qty - 1)} style={{ ...stepperBtnStyle, width: 24, height: 24 }}>
                      <Minus size={11} />
                    </button>
                    <span style={{ width: 20, textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: "#EDEBE4" }}>
                      {qty}
                    </span>
                    <button onClick={() => onSetQty(item.id, qty + 1)} style={{ ...stepperBtnStyle, width: 24, height: 24 }}>
                      <Plus size={11} />
                    </button>
                  </div>
                )}
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 700, color: "#EDEBE4", flexShrink: 0, minWidth: 64, textAlign: "right" }}>
                  {formatBRL(item.priceCents * qty)}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
            background: deltaMeta.soft,
            border: `1px solid ${deltaMeta.color}55`,
            borderRadius: 14,
            padding: "12px 14px",
          }}
        >
          {previewDelta >= 0 ? (
            <TrendingUp size={16} color={deltaMeta.color} style={{ flexShrink: 0 }} />
          ) : (
            <TrendingDown size={16} color={deltaMeta.color} style={{ flexShrink: 0 }} />
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#C7CCD6", lineHeight: 1.42, flex: 1 }}>
            Efeito na popularidade de {p.name}
          </span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: deltaMeta.color, flexShrink: 0 }}>
            {formatScore(previewDelta)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, color: "#9096A6" }}>
            Total
          </span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "#EDEBE4" }}>
            {formatBRL(cartTotalCents)}
          </span>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #2A2E3A", background: "#14161D", padding: "14px 18px", flexShrink: 0 }}>
        <button
          onClick={onPay}
          disabled={paying}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 14px",
            borderRadius: 999,
            border: "none",
            background: "#F5B942",
            color: "#12141C",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: paying ? "default" : "pointer",
            opacity: paying ? 0.85 : 1,
          }}
        >
          {paying ? (
            <>
              <Loader2 size={16} className="poppol-spin" />
              Processando pagamento…
            </>
          ) : (
            <>
              <CreditCard size={16} />
              {`Pagar ${formatBRL(cartTotalCents)} · Pix ou cartão`}
            </>
          )}
        </button>
      </div>
    </>
  );
}

function DetailModal({ p, sentForP, onClose, onSend, onShare }) {
  const cardImg = cardPortraitDataUri(p.id, p.initials);
  const [cart, setCart] = useState({}); // { itemId: qty }
  const [stage, setStage] = useState("browse"); // 'browse' | 'checkout'
  const [paying, setPaying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const payTimer = useRef(null);

  useEffect(() => () => payTimer.current && clearTimeout(payTimer.current), []);

  const receivedTotals = useMemo(() => {
    const totals = {};
    ITEMS.forEach((item) => {
      totals[item.id] = (p.baseByItem[item.id] || 0) + (sentForP[item.id] || 0);
    });
    return totals;
  }, [p, sentForP]);
  const netScore = useMemo(() => netScoreOf(receivedTotals), [receivedTotals]);
  const weighted = useMemo(() => weightedTotalsOf(receivedTotals), [receivedTotals]);
  const receivedItems = useMemo(() => ITEMS.filter((item) => receivedTotals[item.id] > 0), [receivedTotals]);
  const barTotal = weighted.apoio + weighted.rejeicao;
  const apoioPct = barTotal > 0 ? (weighted.apoio / barTotal) * 100 : 50;
  const scoreColor = netScore >= 0 ? TYPE_META.apoio.color : TYPE_META.rejeicao.color;

  const cartEntries = useMemo(
    () => ITEMS.filter((item) => (cart[item.id] || 0) > 0).map((item) => ({ item, qty: cart[item.id] })),
    [cart]
  );
  const cartCount = useMemo(() => sumValues(cart), [cart]);
  const cartTotalCents = useMemo(
    () => cartEntries.reduce((sum, e) => sum + e.item.priceCents * e.qty, 0),
    [cartEntries]
  );
  const previewDelta = useMemo(
    () => cartEntries.reduce((sum, e) => sum + TYPE_META[e.item.type].sign * e.item.value * e.qty, 0),
    [cartEntries]
  );

  const addOne = (itemId) => setCart((c) => ({ ...c, [itemId]: (c[itemId] || 0) + 1 }));
  const setQty = (itemId, qty) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[itemId];
      else next[itemId] = Math.min(99, qty);
      return next;
    });

  const goCheckout = () => {
    if (cartCount > 0) setStage("checkout");
  };
  const backToBrowse = () => setStage("browse");

  const handlePay = () => {
    setPaying(true);
    payTimer.current = setTimeout(() => {
      onSend(cartEntries);
      setCart({});
      setPaying(false);
      setStage("browse");
    }, 900);
  };

  return (
    <div className="poppol-modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "flex-end" }}>
      <div onClick={paying ? undefined : onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,9,13,0.78)" }} />
      <div
        className="poppol-modal poppol-detail-modal"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: "#181B24",
          borderTop: "1px solid #2A2E3A",
          borderRadius: "24px 24px 0 0",
          overflow: "hidden",
          animation: "poppol-sheet-up 220ms ease",
        }}
      >
        {stage === "checkout" ? (
          <CheckoutView
            p={p}
            cart={cart}
            cartEntries={cartEntries}
            cartTotalCents={cartTotalCents}
            previewDelta={previewDelta}
            onBack={backToBrowse}
            onSetQty={setQty}
            onPay={handlePay}
            paying={paying}
          />
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px 24px" }}>
              <button
                onClick={onShare}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 60,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(20,22,29,0.55)",
                  backdropFilter: "blur(6px)",
                  color: "#EDEBE4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 2,
                }}
              >
                <Share2 size={14} />
              </button>
              <button
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid #2A2E3A",
                  background: "#1B1E27",
                  color: "#9096A6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 2,
                }}
              >
                <X size={16} />
              </button>

              <div
                style={{
                  position: "relative",
                  margin: "-20px -22px 0",
                  height: "40vh",
                  minHeight: 280,
                  maxHeight: 400,
                  overflow: "hidden",
                  borderRadius: "24px 24px 0 0",
                  boxSizing: "border-box",
                }}
              >
                <img
                  src={cardImg}
                  alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(0,0,0,0) 34%, rgba(12,13,18,0.78) 76%, #181B24 100%)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "20px 22px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        color: p.party.color,
                        background: "rgba(12,13,18,0.55)",
                        border: `1px solid ${p.party.color}55`,
                        padding: "3px 9px",
                        borderRadius: 6,
                        marginBottom: 8,
                      }}
                    >
                      {p.party.code} · {p.party.name}
                    </span>
                    <div
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 24,
                        fontWeight: 700,
                        color: "#FFFFFF",
                        lineHeight: 1.12,
                        textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#E4E2DA", marginTop: 3 }}>
                      {p.role} · {LEVEL_LABEL[p.level]}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12,
                        color: "#B7BCC7",
                        marginTop: 4,
                      }}
                    >
                      <MapPin size={11} strokeWidth={2} />
                      {locationLabel(p)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "20px 2px 0" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                  <span
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#9096A6",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Popularidade
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 700, color: scoreColor }}>
                    {formatScore(netScore)}
                  </span>
                </div>

                <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "#2A2E3A", marginBottom: 6 }}>
                  <div style={{ width: `${apoioPct}%`, background: TYPE_META.apoio.color }} />
                  <div style={{ width: `${100 - apoioPct}%`, background: TYPE_META.rejeicao.color }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: TYPE_META.apoio.color, fontWeight: 600 }}>
                    {formatCount(weighted.apoio)} de defesa
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: TYPE_META.rejeicao.color, fontWeight: 600 }}>
                    {formatCount(weighted.rejeicao)} de ataque
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 10 }}>
                  {receivedItems.length === 0 ? (
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#6B7180", gridColumn: "1 / -1" }}>
                      Nenhum item recebido ainda.
                    </span>
                  ) : (
                    receivedItems.map((item) => {
                      const count = receivedTotals[item.id];
                      const meta = TYPE_META[item.type];
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 3,
                            background: "#1F2330",
                            border: "1px solid #2A2E3A",
                            borderRadius: 14,
                            padding: "12px 6px 10px",
                          }}
                        >
                          <span style={{ fontSize: 26, lineHeight: 1 }}>{item.emoji}</span>
                          <span
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: "#EDEBE4",
                              textAlign: "center",
                              lineHeight: 1.2,
                            }}
                          >
                            {item.label}
                          </span>
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 9.5, fontWeight: 700, color: meta.color }}>
                            {formatEffect(item)}
                          </span>
                          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#9096A6", marginTop: 1 }}>
                            ×{formatCount(count)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <CartTray
              politicianName={p.name}
              cart={cart}
              onAddOne={addOne}
              onSetQty={setQty}
              cartCount={cartCount}
              cartTotalCents={cartTotalCents}
              onContinue={goCheckout}
              onOpenAll={() => setPickerOpen(true)}
            />
          </>
        )}
      </div>

      {pickerOpen && (
        <ItemPickerSheet
          cart={cart}
          onAddOne={addOne}
          onSetQty={setQty}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

export default function PopPolTreemap() {
  const politicians = useMemo(() => buildPoliticians(26), []);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [level, setLevel] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [sentMap, setSentMap] = useState({}); // { politicianId: { itemId: qty } }
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [size, setSize] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    onResize();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  // O tamanho de cada político no mapa é recalculado sempre que
  // sentMap muda — é isso que faz o grid "respirar" a cada envio,
  // crescendo com apoio e encolhendo com crítica.
  const politiciansWithTotals = useMemo(
    () =>
      politicians.map((p) => {
        const sentForP = sentMap[p.id] || {};
        const netScore = netScoreOf(p.baseByItem) + netScoreOf(sentForP);
        const totalItems = sumValues(p.baseByItem) + sumValues(sentForP);
        return { ...p, netScore, totalItems };
      }),
    [politicians, sentMap]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return politiciansWithTotals.filter((p) => {
      if (level && p.level !== level) return false;
      if (country && p.countryCode !== country) return false;
      if (state && p.stateCode !== state) return false;
      if (city && p.city !== city) return false;
      if (!q) return true;
      const haystack = [p.name, p.role, p.party.name, p.party.code, LEVEL_LABEL[p.level], locationLabel(p)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [politiciansWithTotals, query, country, state, city, level]);

  const rects = useMemo(() => computeTreemap(filtered, size.w, size.h), [filtered, size]);

  const activeFilterCount = [country, state, city, level, query.trim()].filter(Boolean).length;

  const clearFilters = () => {
    setQuery("");
    setCountry("");
    setState("");
    setCity("");
    setLevel("");
  };

  const selected = politicians.find((p) => p.id === selectedId) || null;

  // Só é chamado depois que o pagamento simulado (Pix/cartão) é
  // "aprovado" no checkout — cartEntries é a sacola inteira, com
  // todos os itens (de apoio e/ou crítica) e quantidades escolhidos.
  const handleSend = (p, cartEntries) => {
    setSentMap((prev) => {
      const forP = { ...(prev[p.id] || {}) };
      cartEntries.forEach(({ item, qty }) => {
        forP[item.id] = (forP[item.id] || 0) + qty;
      });
      return { ...prev, [p.id]: forP };
    });
    const itemsCount = cartEntries.reduce((sum, e) => sum + e.qty, 0);
    const totalCents = cartEntries.reduce((sum, e) => sum + e.item.priceCents * e.qty, 0);
    const delta = cartEntries.reduce((sum, e) => sum + TYPE_META[e.item.type].sign * e.item.value * e.qty, 0);
    showToast(
      `Pagamento aprovado — ${itemsCount} ${itemsCount === 1 ? "item enviado" : "itens enviados"} para ${p.name} · ${formatBRL(totalCents)} · popularidade ${formatScore(delta)}`
    );
  };

  const handleShare = (p) => {
    showToast(`Link do perfil de ${p.name} copiado!`);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0C0D12", fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        ::selection { background: #F5B942; color: #12141C; }
        input::placeholder { color: #6B7180; }
        select option { background: #1F2330; color: #EDEBE4; }
        @keyframes poppol-sheet-up {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes poppol-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes poppol-invite-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,185,66,0.45); }
          50% { box-shadow: 0 0 0 6px rgba(245,185,66,0); }
        }
        @keyframes poppol-toast-in {
          from { transform: translate(-50%, -8px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .poppol-modal-overlay {
          padding: 0;
        }
        .poppol-modal {
          box-sizing: border-box;
        }
        @media (min-width: 700px) {
          .poppol-modal-overlay {
            align-items: center !important;
            padding: 28px !important;
          }
          .poppol-modal {
            width: min(100%, 760px) !important;
            max-width: 760px !important;
            max-height: min(820px, calc(100vh - 56px)) !important;
            border: 1px solid #343947 !important;
            border-radius: 24px !important;
            box-shadow: 0 24px 80px rgba(0,0,0,0.48), 0 4px 18px rgba(0,0,0,0.24);
          }
          .poppol-filter-modal {
            width: min(100%, 620px) !important;
            max-width: 620px !important;
            max-height: min(680px, calc(100vh - 56px)) !important;
            padding: 24px 28px 28px !important;
          }
          .poppol-picker-modal {
            width: min(100%, 820px) !important;
            max-width: 820px !important;
            height: min(760px, calc(100vh - 56px)) !important;
            max-height: min(760px, calc(100vh - 56px)) !important;
          }
          .poppol-detail-modal {
            width: min(100%, 940px) !important;
            max-width: 940px !important;
            height: min(820px, calc(100vh - 56px)) !important;
            max-height: min(820px, calc(100vh - 56px)) !important;
          }
          .poppol-detail-modal > div:first-child {
            scrollbar-width: thin;
            scrollbar-color: #3C4250 transparent;
          }
          .poppol-detail-modal img {
            max-height: 440px;
          }
        }
        @media (max-width: 699px) {
          .poppol-modal-overlay {
            padding: 0 !important;
          }
          .poppol-modal {
            max-width: 100% !important;
          }
        }
        @media (min-width: 1100px) {
          .poppol-detail-modal {
            width: min(100%, 1040px) !important;
            max-width: 1040px !important;
          }
        }
        .poppol-spin { animation: poppol-spin-anim 0.8s linear infinite; }
        @keyframes poppol-spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ position: "absolute", inset: 0 }}>
        {filtered.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#6B7180",
              textAlign: "center",
              padding: 20,
            }}
          >
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, color: "#9096A6", marginBottom: 6 }}>
              Nenhum político encontrado
            </div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>Tente ajustar o local, o nível ou a busca.</div>
            <button
              onClick={clearFilters}
              style={{
                background: "#F5B94222",
                border: "1px solid #F5B942",
                color: "#F5B942",
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 16px",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          rects.map((rect) => (
            <TreemapCell
              key={rect.item.id}
              rect={rect}
              gap={4}
              onClick={() => setSelectedId(rect.item.id)}
            />
          ))
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          right: 14,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: "#EDEBE4",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            background: "rgba(20,22,29,0.5)",
            backdropFilter: "blur(6px)",
            padding: "7px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          PopPol
        </span>

        <button
          onClick={() => setFilterOpen(true)}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(20,22,29,0.55)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 999,
            padding: "8px 14px",
            color: "#EDEBE4",
            fontFamily: "'Inter', sans-serif",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {activeFilterCount > 0 && (
            <span
              style={{
                minWidth: 16,
                height: 16,
                borderRadius: 999,
                background: "#F5B942",
                color: "#12141C",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filterOpen && (
        <FilterSheet
          query={query}
          setQuery={setQuery}
          country={country}
          setCountry={setCountry}
          state={state}
          setState={setState}
          city={city}
          setCity={setCity}
          level={level}
          setLevel={setLevel}
          resultCount={filtered.length}
          onClose={() => setFilterOpen(false)}
          onClear={clearFilters}
        />
      )}

      {selected && (
        <DetailModal
          p={selected}
          sentForP={sentMap[selected.id] || {}}
          onClose={() => setSelectedId(null)}
          onSend={(cartEntries) => handleSend(selected, cartEntries)}
          onShare={() => handleShare(selected)}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            zIndex: 80,
            transform: "translateX(-50%)",
            background: "#1B1E27",
            border: "1px solid #2A2E3A",
            color: "#EDEBE4",
            fontFamily: "'Inter', sans-serif",
            fontSize: 12.5,
            fontWeight: 600,
            padding: "9px 16px",
            borderRadius: 999,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            animation: "poppol-toast-in 180ms ease",
            whiteSpace: "nowrap",
            maxWidth: "88%",
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
