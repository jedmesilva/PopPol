import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Globe2,
  Landmark,
  MapPin,
  Menu,
  MessageSquare,
  Minus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  getGetOverviewStatsQueryKey,
  getGetPoliticianQueryKey,
  getListActivityQueryKey,
  getListPoliticiansQueryKey,
  useCreateManifestation,
  useGetOverviewStats,
  useGetPolitician,
  useListActivity,
  useListPoliticians,
} from '@workspace/api-client-react';
import type {
  ActivityItem,
  ManifestationItem,
  Politician,
  PoliticianProfile,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const formatNumber = (value?: number) =>
  typeof value === 'number' ? new Intl.NumberFormat('pt-BR').format(value) : '—';

const formatDate = (value?: string) => {
  if (!value) return 'Agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
};

const formatRelative = (value?: string) => {
  if (!value) return 'agora';
  const delta = Math.max(0, Date.now() - new Date(value).getTime());
  const hours = Math.floor(delta / 36e5);
  if (hours < 1) return 'agora há pouco';
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
};

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-3" data-testid="link-logo">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[3px_3px_0_hsl(var(--foreground))] transition-transform duration-200 group-hover:-translate-y-0.5">
        <Landmark size={18} strokeWidth={2.4} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--sidebar))] bg-[hsl(var(--primary))]" />
      </span>
      <span className="font-mono-civic text-[15px] font-medium tracking-[0.16em] text-current">POPPOL</span>
    </Link>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const navItems = [
    { href: '/', label: 'Descobrir', icon: Search },
    { href: '/#activity', label: 'Praça pública', icon: Activity },
  ];

  return (
    <div className="noise min-h-[100dvh] bg-[hsl(var(--background))]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between bg-[hsl(var(--sidebar))] px-6 py-7 text-[hsl(var(--sidebar-foreground))] md:flex">
        <div>
          <Logo />
          <div className="mt-16">
            <p className="font-mono-civic text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--sidebar-foreground)/.45)]">Navegação</p>
            <nav className="mt-4 space-y-1" aria-label="Navegação principal">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === '/' && location === '/';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${active ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.62)] hover:bg-[hsl(var(--sidebar-accent)/.65)] hover:text-[hsl(var(--sidebar-foreground))]'}`}
                    data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
                  >
                    <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
                    <span>{item.label}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="mt-14 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.35)] p-4">
            <div className="flex items-center gap-2 text-[hsl(var(--sidebar-primary))]">
              <ShieldCheck size={15} />
              <span className="font-mono-civic text-[10px] uppercase tracking-[0.14em]">Transparência</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[hsl(var(--sidebar-foreground)/.65)]">
              Cada manifestação é pública, contextualizada e ligada a uma pessoa real.
            </p>
          </div>
        </div>
        <div className="border-t border-[hsl(var(--sidebar-border))] pt-4">
          <p className="font-mono-civic text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--sidebar-foreground)/.38)]">PopPol / 2024</p>
          <p className="mt-2 text-xs text-[hsl(var(--sidebar-foreground)/.54)]">Participar é acompanhar.</p>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[hsl(var(--border)/.75)] bg-[hsl(var(--background)/.9)] px-5 backdrop-blur-xl md:hidden">
          <Logo />
          <button
            type="button"
            onClick={() => setMobileNav((open) => !open)}
            className="rounded-lg p-2 text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            aria-label="Abrir navegação"
            data-testid="button-toggle-navigation"
          >
            {mobileNav ? <X size={21} /> : <Menu size={21} />}
          </button>
        </header>
        {mobileNav && (
          <nav className="absolute left-0 right-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-lg md:hidden" aria-label="Navegação móvel">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[hsl(var(--muted))]" data-testid={`link-mobile-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
                  <Icon size={17} /> {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <main className="min-h-[calc(100dvh-72px)]">{children}</main>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: ReactNode; description?: string; children?: ReactNode }) {
  return (
    <div className="border-b border-[hsl(var(--border)/.8)] px-5 pb-8 pt-9 md:px-10 md:pb-10 md:pt-12">
      <div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-7 lg:flex-row lg:items-end">
        <div className="animate-enter">
          <p className="font-mono-civic text-[10px] font-medium uppercase tracking-[0.22em] text-[hsl(var(--primary))]">{eyebrow}</p>
          <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.6rem,5vw,5.2rem)] leading-[.91] tracking-[-.045em] text-[hsl(var(--foreground))]">{title}</h1>
          {description && <p className="mt-5 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>}
        </div>
        {children && <div className="animate-enter-delay">{children}</div>}
      </div>
    </div>
  );
}

function LoadingBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[hsl(var(--muted))] ${className}`} aria-label="Carregando" data-testid="status-loading" />;
}

function ErrorState({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-3 py-7' : 'min-h-44 flex-col justify-center gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center'}`} data-testid="status-error">
      <AlertCircle size={compact ? 17 : 22} className="text-[hsl(var(--accent))]" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Não conseguimos atualizar esta parte da praça.</p>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold hover:bg-[hsl(var(--muted))]" data-testid="button-retry">
        <RefreshCw size={13} /> Tentar novamente
      </button>
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, accent = 'primary', loading = false }: { label: string; value?: string | number; detail: string; icon: typeof Users; accent?: 'primary' | 'accent'; loading?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-card)]" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className={`absolute right-0 top-0 h-16 w-16 rounded-bl-[44px] ${accent === 'accent' ? 'bg-[hsl(var(--accent)/.12)]' : 'bg-[hsl(var(--primary)/.1)]'}`} />
      <div className="relative flex items-start justify-between">
        <span className="font-mono-civic text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">{label}</span>
        <Icon size={17} className={accent === 'accent' ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--primary))]'} />
      </div>
      {loading ? <LoadingBlock className="mt-4 h-9 w-24" /> : <p className="relative mt-3 font-display text-4xl tracking-[-.04em]" data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>}
      <p className="relative mt-2 text-xs text-[hsl(var(--muted-foreground))]">{detail}</p>
    </div>
  );
}

function ScoreRing({ score, large = false }: { score: number; large?: boolean }) {
  const safeScore = Math.max(0, Math.min(100, score || 0));
  return (
    <div className={`relative flex shrink-0 items-center justify-center rounded-full ${large ? 'h-28 w-28' : 'h-[68px] w-[68px]'}`} style={{ background: `conic-gradient(hsl(var(--primary)) ${safeScore}%, hsl(var(--muted)) 0)` }} data-testid="display-score-ring">
      <div className={`flex items-center justify-center rounded-full bg-[hsl(var(--card))] ${large ? 'h-[88px] w-[88px]' : 'h-[54px] w-[54px]'}`}>
        <span className={`font-mono-civic font-medium ${large ? 'text-2xl' : 'text-base'}`}>{Math.round(safeScore)}</span>
      </div>
    </div>
  );
}

function PartyPill({ party }: { party: Politician['party'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background)/.7)] px-2.5 py-1 font-mono-civic text-[10px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]" data-testid={`badge-party-${party.code}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: party.color }} />
      {party.code}
    </span>
  );
}

function PoliticianCard({ politician, index }: { politician: Politician; index: number }) {
  const isPositive = politician.trend >= 0;
  return (
    <Link href={`/politicians/${politician.id}`} className="hover-lift group relative block overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-card)]" data-testid={`card-politician-${politician.id}`}>
      <div className="absolute -right-5 -top-8 font-display text-[8rem] leading-none text-[hsl(var(--muted)/.62)] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1">{String(index + 1).padStart(2, '0')}</div>
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[hsl(var(--primary)/.12)] font-mono-civic text-xs font-medium text-[hsl(var(--primary))]" data-testid={`avatar-politician-${politician.id}`}>{politician.initials}</div>
          <div>
            <h3 className="max-w-[190px] truncate text-base font-extrabold tracking-[-.02em]">{politician.name}</h3>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{politician.role}</p>
          </div>
        </div>
        <ArrowUpRight size={18} className="text-[hsl(var(--muted-foreground)/.6)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[hsl(var(--accent))]" />
      </div>
      <div className="relative mt-7 flex items-end justify-between border-t border-[hsl(var(--border)/.8)] pt-4">
        <div>
          <div className="flex items-center gap-2"><PartyPill party={politician.party} /><span className="text-[11px] text-[hsl(var(--muted-foreground))]">{politician.region}</span></div>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className={`font-mono-civic ${isPositive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--accent))]'}`}>{isPositive ? '+' : ''}{politician.trend.toFixed(1)}%</span>
            {isPositive ? <TrendingUp size={13} className="text-[hsl(var(--primary))]" /> : <Minus size={13} className="text-[hsl(var(--accent))]" />}
            <span className="text-[hsl(var(--muted-foreground))]">no último mês</span>
          </div>
        </div>
        <ScoreRing score={politician.score} />
      </div>
    </Link>
  );
}

function ActivityRow({ activity, compact = false }: { activity: ActivityItem; compact?: boolean }) {
  const positive = activity.kind === 'apoio';
  return (
    <Link href={`/politicians/${activity.politicianId}`} className="group flex items-center gap-3 border-b border-[hsl(var(--border)/.75)] py-3.5 last:border-0" data-testid={`activity-${activity.id}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${positive ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))]'}`}>
        {positive ? <ThumbsUp size={15} /> : <ThumbsDown size={15} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-[hsl(var(--foreground))]">{activity.itemLabel}</p>
        <p className="mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{activity.politicianName} {compact ? '' : `· ${activity.region}`}</p>
      </div>
      <span className="shrink-0 font-mono-civic text-[10px] text-[hsl(var(--muted-foreground))]">{formatRelative(activity.createdAt)}</span>
    </Link>
  );
}

function Home() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('relevancia');
  const params = useMemo(() => ({
    q: search || undefined,
    level: (level || undefined) as 'federal' | 'estadual' | 'municipal' | undefined,
    region: region || undefined,
    sort: sort as 'relevancia' | 'apoio' | 'critica',
  }), [search, level, region, sort]);
  const politiciansQuery = useListPoliticians(params, { query: { queryKey: getListPoliticiansQueryKey(params), staleTime: 30_000 } });
  const activityQuery = useListActivity({ query: { queryKey: getListActivityQueryKey(), staleTime: 30_000 } });
  const statsQuery = useGetOverviewStats({ query: { queryKey: getGetOverviewStatsQueryKey(), staleTime: 30_000 } });
  const politicians = politiciansQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const stats = statsQuery.data;

  return (
    <AppShell>
      <PageHeader eyebrow="Observatório cidadão / ao vivo" title={<>O poder público,<br /><em className="text-[hsl(var(--accent))]">sem filtro.</em></>} description="Descubra quem decide, entenda o contexto e deixe sua posição registrada. A praça pública é de todos.">
        <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] px-3 py-2.5 shadow-sm">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-[pulse-dot_2s_infinite] rounded-full bg-[hsl(var(--primary))]" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--primary))]" /></span>
          <span className="font-mono-civic text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">dados atualizados agora</span>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard label="Representantes" value={formatNumber(stats?.totalPoliticians)} detail="monitorados na plataforma" icon={Users} loading={statsQuery.isLoading} />
          <StatCard label="Manifestações" value={formatNumber(stats?.totalManifestations)} detail="posições públicas registradas" icon={MessageSquare} accent="accent" loading={statsQuery.isLoading} />
          <StatCard label="Regiões ativas" value={formatNumber(stats?.activeRegions)} detail="com participação recente" icon={Globe2} loading={statsQuery.isLoading} />
          <StatCard label="Apoio geral" value={stats ? `${stats.supportPercentage.toFixed(1)}%` : '—'} detail="do sentimento manifestado" icon={TrendingUp} accent="accent" loading={statsQuery.isLoading} />
        </div>
        {statsQuery.isError && <ErrorState onRetry={() => statsQuery.refetch()} compact />}

        <section className="mt-14" aria-labelledby="discover-heading">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono-civic text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">01 / Mapa de poder</p>
              <h2 id="discover-heading" className="mt-2 font-display text-4xl tracking-[-.04em]">Quem está no radar</h2>
            </div>
            <span className="font-mono-civic text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{politicians.length ? `${politicians.length} resultados` : 'busque para começar'}</span>
          </div>
          <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] p-3 shadow-sm md:p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1.8fr)_1fr_1fr_1fr]">
              <label className="relative block">
                <span className="sr-only">Buscar político</span>
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou cargo" className="h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground)/.7)] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.12)]" data-testid="input-search-politicians" />
              </label>
              <label className="relative">
                <span className="sr-only">Nível de governo</span>
                <select value={level} onChange={(event) => setLevel(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="select-level">
                  <option value="">Todos os níveis</option><option value="federal">Federal</option><option value="estadual">Estadual</option><option value="municipal">Municipal</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              </label>
              <label className="relative">
                <span className="sr-only">Região</span>
                <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Região" className="h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-9 pr-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-region" />
              </label>
              <label className="relative">
                <span className="sr-only">Ordenar resultados</span>
                <SlidersHorizontal size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-9 pr-8 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="select-sort">
                  <option value="relevancia">Mais relevantes</option><option value="apoio">Mais apoiados</option><option value="critica">Mais criticados</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              </label>
            </div>
          </div>

          {politiciansQuery.isLoading ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <LoadingBlock key={item} className="h-56" />)}</div>
          ) : politiciansQuery.isError ? <div className="mt-5"><ErrorState onRetry={() => politiciansQuery.refetch()} /></div>
            : politicians.length === 0 ? (
              <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] px-6 py-16 text-center" data-testid="empty-politicians">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Search size={20} /></div>
                <h3 className="mt-4 font-display text-2xl">Nada apareceu ainda</h3>
                <p className="mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">Tente remover um filtro ou buscar por outro nome.</p>
                <button type="button" onClick={() => { setSearch(''); setLevel(''); setRegion(''); }} className="mt-5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-clear-filters">Limpar filtros</button>
              </div>
            ) : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{politicians.map((politician, index) => <PoliticianCard key={politician.id} politician={politician} index={index} />)}</div>}
        </section>

        <section id="activity" className="mt-16 grid gap-7 border-t border-[hsl(var(--border))] pt-10 lg:grid-cols-[1.3fr_.7fr]" aria-labelledby="activity-heading">
          <div>
            <div className="flex items-end justify-between">
              <div><p className="font-mono-civic text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">02 / Pulso recente</p><h2 id="activity-heading" className="mt-2 font-display text-4xl tracking-[-.04em]">O que está sendo dito</h2></div>
              <Activity size={22} className="text-[hsl(var(--accent))]" />
            </div>
            <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 shadow-[var(--shadow-card)]">
              {activityQuery.isLoading ? <div className="space-y-2 py-5"><LoadingBlock className="h-12" /><LoadingBlock className="h-12" /><LoadingBlock className="h-12" /></div>
                : activityQuery.isError ? <ErrorState onRetry={() => activityQuery.refetch()} compact />
                  : activity.length === 0 ? <div className="py-12 text-center" data-testid="empty-activity"><Clock3 className="mx-auto text-[hsl(var(--muted-foreground))]" /><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">A praça ainda está silenciosa.</p></div>
                    : activity.slice(0, 6).map((item) => <ActivityRow key={item.id} activity={item} />)}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--foreground))] p-7 text-[hsl(var(--background))]">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border-[18px] border-[hsl(var(--accent)/.8)]" />
            <div className="absolute bottom-5 right-8 h-3 w-3 rounded-full bg-[hsl(var(--primary))]" />
            <BarChart3 size={20} className="text-[hsl(var(--primary))]" />
            <h3 className="mt-16 max-w-[220px] font-display text-3xl leading-none tracking-[-.035em]">Contexto antes de opinião.</h3>
            <p className="mt-4 max-w-[250px] text-sm leading-6 text-[hsl(var(--background)/.65)]">Compare níveis, regiões e histórico antes de formar seu ponto de vista.</p>
            <div className="mt-8 flex items-center gap-2 font-mono-civic text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]"><span className="h-px w-7 bg-[hsl(var(--primary))]" /> explore a praça</div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SentimentBar({ support, criticism }: { support: number; criticism: number }) {
  const total = Math.max(1, (support || 0) + (criticism || 0));
  const supportPct = (support / total) * 100;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[hsl(var(--accent)/.16)]" aria-label="Distribuição de sentimento" data-testid="display-sentiment-bar">
        <div className="bg-[hsl(var(--primary))] transition-all duration-700" style={{ width: `${supportPct}%` }} />
      </div>
      <div className="mt-3 flex justify-between text-xs">
        <span className="flex items-center gap-2 font-semibold text-[hsl(var(--primary))]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" /> Apoio <b>{formatNumber(support)}</b></span>
        <span className="flex items-center gap-2 font-semibold text-[hsl(var(--accent))]"><b>{formatNumber(criticism)}</b> Crítica <span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /></span>
      </div>
    </div>
  );
}

function ManifestationPanel({ profile, onClose, onSuccess }: { profile: PoliticianProfile; onClose: () => void; onSuccess: () => void }) {
  const [itemId, setItemId] = useState('');
  const [note, setNote] = useState('');
  const manifestation = useCreateManifestation();
  const selected = profile.items.find((item) => item.id === itemId);
  const positiveItems = profile.items.filter((item) => item.kind === 'apoio');
  const criticalItems = profile.items.filter((item) => item.kind === 'critica');
  const submit = () => {
    if (!itemId || manifestation.isPending) return;
    manifestation.mutate({ id: profile.id, data: { itemId, note: note.trim() || null } }, { onSuccess: () => { onSuccess(); onClose(); } });
  };
  const ItemChoice = ({ item }: { item: ManifestationItem }) => {
    const positive = item.kind === 'apoio';
    const active = item.id === itemId;
    return (
      <button type="button" onClick={() => setItemId(item.id)} className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${active ? (positive ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.09)]' : 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.09)]') : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground)/.5)]'}`} aria-pressed={active} data-testid={`button-manifest-item-${item.id}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${positive ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))]'}`}>{positive ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}</span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-bold">{item.label}</span><span className="mt-1 block font-mono-civic text-[9px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">peso {item.weight}</span></span>
        {active && <Check size={16} className={positive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--accent))]'} />}
      </button>
    );
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--foreground)/.48)] p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="manifest-title">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[26px] bg-[hsl(var(--card))] shadow-2xl sm:rounded-[26px]">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.96)] px-5 py-5 backdrop-blur-xl md:px-7">
          <div><p className="font-mono-civic text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Sua voz / agora</p><h2 id="manifest-title" className="mt-2 font-display text-3xl tracking-[-.035em]">Manifestar sobre {profile.name}</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Escolha uma posição. Contexto é bem-vindo.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" aria-label="Fechar manifestação" data-testid="button-close-manifestation"><X size={19} /></button>
        </div>
        <div className="space-y-6 px-5 py-6 md:px-7">
          {profile.items.length === 0 ? <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-manifestation-items">Não há itens de manifestação disponíveis para este perfil.</div> : <>
            {positiveItems.length > 0 && <div><p className="mb-2 flex items-center gap-2 font-mono-civic text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]"><ThumbsUp size={13} /> Apoiar</p><div className="grid gap-2 md:grid-cols-2">{positiveItems.map((item) => <ItemChoice key={item.id} item={item} />)}</div></div>}
            {criticalItems.length > 0 && <div><p className="mb-2 flex items-center gap-2 font-mono-civic text-[10px] uppercase tracking-[.16em] text-[hsl(var(--accent))]"><ThumbsDown size={13} /> Criticar</p><div className="grid gap-2 md:grid-cols-2">{criticalItems.map((item) => <ItemChoice key={item.id} item={item} />)}</div></div>}
            <div><div className="flex items-center justify-between"><label htmlFor="manifest-note" className="text-xs font-bold">Nota pública <span className="font-normal text-[hsl(var(--muted-foreground))]">(opcional)</span></label><span className="font-mono-civic text-[10px] text-[hsl(var(--muted-foreground))]">{note.length}/280</span></div><textarea id="manifest-note" value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} placeholder="O que sustenta sua posição?" className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground)/.7)] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.12)]" data-testid="textarea-manifestation-note" /></div>
            {manifestation.isError && <p className="flex items-center gap-2 rounded-lg bg-[hsl(var(--accent)/.1)] px-3 py-2.5 text-xs text-[hsl(var(--accent))]" data-testid="status-manifestation-error"><AlertCircle size={14} /> Sua manifestação não foi registrada. Tente novamente.</p>}
            <button type="button" disabled={!selected || manifestation.isPending} onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--foreground))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--background))] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-submit-manifestation">
              {manifestation.isPending ? <><RefreshCw size={16} className="animate-spin" /> Registrando...</> : <><Send size={16} /> Registrar manifestação</>}
            </button>
            <p className="text-center text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">Sua participação fica pública e ajuda a formar o pulso coletivo.</p>
          </>}
        </div>
      </div>
    </div>
  );
}

function Profile() {
  const { id } = useParams<{ id: string }>();
  const [panelOpen, setPanelOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const profileQuery = useGetPolitician(id ?? '', { query: { queryKey: getGetPoliticianQueryKey(id ?? ''), staleTime: 30_000 } });
  const profile = profileQuery.data;
  const queryClient = useQueryClient();
  const onManifestSuccess = () => {
    setSuccess(true);
    window.setTimeout(() => setSuccess(false), 4500);
    void queryClient.invalidateQueries({ queryKey: getGetPoliticianQueryKey(id ?? '') });
    void queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetOverviewStatsQueryKey() });
  };

  if (profileQuery.isLoading) return <AppShell><div className="mx-auto max-w-[1320px] px-5 py-12 md:px-10"><LoadingBlock className="h-6 w-24" /><LoadingBlock className="mt-8 h-64" /><div className="mt-7 grid gap-5 lg:grid-cols-3"><LoadingBlock className="h-60 lg:col-span-2" /><LoadingBlock className="h-60" /></div></div></AppShell>;
  if (profileQuery.isError || !profile) return <AppShell><div className="mx-auto max-w-[1320px] px-5 py-12 md:px-10"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-back-error"><ArrowLeft size={16} /> Voltar para descoberta</Link><div className="mt-8"><ErrorState onRetry={() => profileQuery.refetch()} /></div></div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--primary))]" data-testid="link-back-discover"><ArrowLeft size={15} /> Voltar para descoberta</Link>
        <section className="animate-enter relative mt-6 overflow-hidden rounded-[26px] bg-[hsl(var(--foreground))] px-6 py-8 text-[hsl(var(--background))] md:px-10 md:py-10">
          <div className="absolute right-0 top-0 h-full w-2/5 opacity-70" style={{ background: `radial-gradient(circle at 70% 25%, ${profile.party.color} 0, transparent 54%)` }} />
          <div className="relative flex flex-col justify-between gap-9 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-[hsl(var(--background)/.2)] bg-[hsl(var(--background)/.1)] font-mono-civic text-xl">{profile.initials}</div>
              <div><div className="flex flex-wrap items-center gap-2"><PartyPill party={profile.party} /><span className="font-mono-civic text-[10px] uppercase tracking-[.12em] text-[hsl(var(--background)/.55)]">{profile.level}</span></div><h1 className="mt-3 font-display text-5xl leading-[.9] tracking-[-.05em] md:text-6xl" data-testid="text-politician-name">{profile.name}</h1><p className="mt-3 text-sm text-[hsl(var(--background)/.65)]">{profile.role} · {profile.region}</p></div>
            </div>
            <button type="button" onClick={() => setPanelOpen(true)} className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--accent))] px-5 py-3.5 text-sm font-extrabold text-[hsl(var(--accent-foreground))] transition-transform hover:-translate-y-0.5" data-testid="button-open-manifestation"><MessageSquare size={17} /> Manifestar agora <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
          </div>
        </section>
        {success && <div className="mt-4 flex items-center gap-3 rounded-xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.1)] px-4 py-3 text-sm text-[hsl(var(--primary))]" role="status" data-testid="status-manifestation-success"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Check size={14} /></span> Manifestação registrada. Obrigado por participar da praça.</div>}

        <div className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-card)] md:p-7">
              <div className="flex items-center gap-2 font-mono-civic text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]"><ShieldCheck size={14} /> contexto</div>
              <p className="mt-5 max-w-2xl font-display text-2xl leading-[1.15] tracking-[-.025em]" data-testid="text-politician-bio">{profile.bio}</p>
              <div className="mt-7 border-t border-[hsl(var(--border))] pt-5"><p className="font-mono-civic text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Mandatos e funções</p><div className="mt-3 flex flex-wrap gap-2">{profile.mandates.length ? profile.mandates.map((mandate) => <span key={mandate} className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-xs font-semibold">{mandate}</span>) : <span className="text-sm text-[hsl(var(--muted-foreground))]">Nenhum mandato informado.</span>}</div></div>
            </section>
            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-card)] md:p-7">
              <div className="flex items-center justify-between"><div><p className="font-mono-civic text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Histórico aberto</p><h2 className="mt-2 font-display text-3xl tracking-[-.035em]">Pulso da praça</h2></div><Clock3 size={19} className="text-[hsl(var(--accent))]" /></div>
              <div className="mt-5">{profile.recentActivity?.length ? profile.recentActivity.map((item) => <ActivityRow key={item.id} activity={item} compact />) : <div className="rounded-xl border border-dashed border-[hsl(var(--border))] py-10 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-profile-activity">Ainda não há manifestações neste perfil.</div>}</div>
            </section>
          </div>
          <aside className="space-y-5">
            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between"><div><p className="font-mono-civic text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Índice público</p><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">leitura do momento</p></div><ScoreRing score={profile.score} large /></div>
              <div className="mt-6"><SentimentBar support={profile.support} criticism={profile.criticism} /></div>
              <div className="mt-6 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4 text-xs"><span className="text-[hsl(var(--muted-foreground))]">Tendência</span><span className={`flex items-center gap-1 font-mono-civic ${profile.trend >= 0 ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--accent))]'}`}>{profile.trend >= 0 ? <TrendingUp size={13} /> : <Minus size={13} />}{profile.trend >= 0 ? '+' : ''}{profile.trend.toFixed(1)}%</span></div>
            </section>
            <section className="paper-grid rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.58)] p-6">
              <MapPin size={18} className="text-[hsl(var(--accent))]" /><p className="mt-7 font-display text-2xl leading-tight tracking-[-.025em]">A opinião pública muda quando encontra contexto.</p><p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Veja a trajetória antes de reagir ao momento.</p>
            </section>
          </aside>
        </div>
      </div>
      {panelOpen && <ManifestationPanel profile={profile} onClose={() => setPanelOpen(false)} onSuccess={onManifestSuccess} />}
    </AppShell>
  );
}

function Router() {
  return (
    <ErrorBoundary resetKey={useLocation()[0]}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/politicians/:id" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;