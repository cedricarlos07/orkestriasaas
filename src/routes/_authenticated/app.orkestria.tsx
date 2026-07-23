import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Paperclip,
  Sparkles,
  BarChart3,
  FileText,
  Rocket,
  Users,
  Plus,
  MessageSquare,
  Trash2,
  Search,
  Cog,
  Database,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Filter,
  ArrowLeft,
  Clock,
  Target,
} from "lucide-react";
import { useOrkestriaChat } from "@/lib/orkestria-chat";

export const Route = createFileRoute("/_authenticated/app/orkestria")({ component: OrkestriaPage });

// ---------- Types & storage ----------

type ToolCall = {
  name: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
};

type Msg = {
  id: string;
  role: "user" | "agent";
  text: string;
  tools?: ToolCall[];
  createdAt: number;
};

type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Msg[];
};

const uid = () => Math.random().toString(36).slice(2, 10);

const WELCOME = "Bonjour 👋 Dites-moi ce que je peux faire pour vous aujourd'hui. Vous pouvez me demander un audit, un rapport, ou de lancer une campagne.";

function newThread(): Thread {
  return {
    id: uid(),
    title: "Nouvelle conversation",
    updatedAt: Date.now(),
    messages: [{ id: uid(), role: "agent", text: WELCOME, createdAt: Date.now() }],
  };
}

// ---------- Suggestions & guided intents ----------

type IntentKey = "audit" | "report" | "campaign";

const SUGGESTIONS: { t: string; i: typeof BarChart3; grad: string; ic: string; intent?: IntentKey }[] = [
  { t: "Analyse mes campagnes des 30 derniers jours", i: BarChart3, grad: "from-[#fff1e2] via-[#ffe0c2] to-[#ffcf9c]", ic: "text-[#c94a00]", intent: "audit" },
  { t: "Fais le rapport de la semaine", i: FileText, grad: "from-[#e6f7ee] via-[#c9edd8] to-[#a9e0bf]", ic: "text-[#0f7a3c]", intent: "report" },
  { t: "Lance une campagne pour mon nouveau menu", i: Rocket, grad: "from-[#ffe6ee] via-[#ffc7d8] to-[#ffa3bd]", ic: "text-[#9e1e4a]", intent: "campaign" },
  { t: "Vérifier ma configuration V1", i: Cog, grad: "from-[#f0f4ff] via-[#dce4ff] to-[#c2d0ff]", ic: "text-[#1b3a8a]" },
  { t: "Prépare un rapport dirigeant sur mes campagnes Meta", i: Users, grad: "from-[#f0e6ff] via-[#dcc7ff] to-[#c2a3ff]", ic: "text-[#4a2a9e]" },
];

type FormState = {
  intent: IntentKey;
  scope: string;
  detail: string;
};

const INTENT_META: Record<IntentKey, { label: string; icon: typeof BarChart3; scopes: string[]; detailPh: string; grad: string }> = {
  audit: {
    label: "Audit publicitaire",
    icon: BarChart3,
    scopes: ["7 derniers jours", "30 derniers jours", "90 derniers jours"],
    detailPh: "Ex : concentre-toi sur Meta et le tracking",
    grad: "from-[#ff8a2b] to-[#ff5e00]",
  },
  report: {
    label: "Rapport hebdomadaire",
    icon: FileText,
    scopes: ["Cette semaine", "Semaine dernière", "Mois en cours"],
    detailPh: "Ex : format client, mettre en avant le ROAS",
    grad: "from-[#2fbf6b] to-[#0f7a3c]",
  },
  campaign: {
    label: "Lancement de campagne",
    icon: Rocket,
    scopes: ["Notoriété", "Trafic", "Conversions / ventes"],
    detailPh: "Ex : nouveau menu, budget $50/j, Dakar",
    grad: "from-[#ff3d78] to-[#9e1e4a]",
  },
};

// ---------- Simulated agent tools + reply ----------

function detectIntent(t: string): IntentKey | null {
  const l = t.toLowerCase();
  if (l.includes("audit") || l.includes("analyse")) return "audit";
  if (l.includes("rapport")) return "report";
  if (l.includes("campagne") || l.includes("lance") || l.includes("lancer")) return "campaign";
  return null;
}

function planTools(intent: IntentKey | null): ToolCall[] {
  if (intent === "audit")
    return [
      { name: "connect_accounts", label: "Lecture des comptes publicitaires" },
      { name: "normalize_data", label: "Normalisation des métriques 30j" },
      { name: "tracking_check", label: "Vérification du pixel & GA4" },
      { name: "diagnose", label: "Diagnostic dépenses / créations / audiences" },
    ].map((t) => ({ ...t, status: "running" as const }));
  if (intent === "report")
    return [
      { name: "fetch_week", label: "Extraction des dépenses & résultats de la semaine" },
      { name: "compute_kpis", label: "Calcul ROAS, CPA et marge" },
      { name: "render_report", label: "Mise en page du rapport PDF" },
    ].map((t) => ({ ...t, status: "running" as const }));
  if (intent === "campaign")
    return [
      { name: "brief", label: "Lecture du brief et de l'objectif" },
      { name: "audience_plan", label: "Construction des audiences Meta / Google / TikTok" },
      { name: "budget_split", label: "Répartition du budget & enchères" },
      { name: "creative_prep", label: "Préparation des variantes créatives" },
    ].map((t) => ({ ...t, status: "running" as const }));
  return [
    { name: "think", label: "Analyse de la demande", status: "running" as const },
    { name: "lookup", label: "Recherche dans la mémoire projet", status: "running" as const },
  ];
}

function titleFromFirstUserMsg(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 42) + "…" : t;
}

function threadType(t: Thread): IntentKey | null {
  for (const m of t.messages) {
    if (m.role !== "user") continue;
    const i = detectIntent(m.text);
    if (i) return i;
  }
  return null;
}

function relevanceScore(t: Thread, q: string) {
  if (!q) return 0;
  const ql = q.toLowerCase();
  let score = 0;
  if (t.title.toLowerCase().includes(ql)) score += 10;
  for (const m of t.messages) {
    const idx = m.text.toLowerCase().indexOf(ql);
    if (idx !== -1) score += m.role === "user" ? 3 : 2;
  }
  return score;
}

// ---------- Page ----------

function OrkestriaPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const {
    threads: serverThreads,
    createThread: srvCreate,
    deleteThread: srvDelete,
    sendMessage,
    isSending,
  } = useOrkestriaChat(activeId, setActiveId);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | IntentKey | "other">("all");
  const [sortBy, setSortBy] = useState<"date" | "relevance">("date");
  const [sendingIntent, setSendingIntent] = useState<IntentKey | null>(null);
  const pending = isSending
    ? {
        text: sendingIntent ? INTENT_META[sendingIntent].label : "Orkestria analyse votre demande…",
        tools: [] as ToolCall[],
      }
    : null;
  const [formIntent, setFormIntent] = useState<IntentKey | null>(null);
  const [form, setForm] = useState<FormState>({ intent: "audit", scope: "30 derniers jours", detail: "" });
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? threads[0],
    [threads, activeId],
  );

  useEffect(() => {
    if (serverThreads.length) {
      setThreads(serverThreads as Thread[]);
      if (!activeId) setActiveId(serverThreads[0]?.id ?? null);
    }
  }, [serverThreads, activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, pending]);
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  // Prefill from landing hero prompt
  useEffect(() => {
    try {
      const pitch = sessionStorage.getItem("orkestria_landing_pitch");
      if (!pitch?.trim()) return;
      setInput(pitch.trim());
      sessionStorage.removeItem("orkestria_landing_pitch");
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      /* ignore */
    }
  }, []);

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...threads];
    if (typeFilter !== "all") {
      list = list.filter((t) => {
        const tt = threadType(t);
        return typeFilter === "other" ? tt === null : tt === typeFilter;
      });
    }
    if (q) {
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.messages.some((m) => m.text.toLowerCase().includes(q)),
      );
    }
    if (sortBy === "relevance" && q) {
      list.sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q) || b.updatedAt - a.updatedAt);
    } else {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return list;
  }, [threads, query, typeFilter, sortBy]);

  const updateThread = (id: string, updater: (t: Thread) => Thread) => {
    setThreads((list) => list.map((t) => (t.id === id ? updater(t) : t)));
  };

  const createThread = () => {
    void srvCreate();
    setSidebarOpenMobile(false);
    setSendingIntent(null);
    setFormIntent(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const selectThread = (id: string) => {
    setActiveId(id);
    setSidebarOpenMobile(false);
    setSendingIntent(null);
  };

  const deleteThread = (id: string) => {
    srvDelete(id);
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || isSending || !activeId) return;
    const intent = detectIntent(text);
    setSendingIntent(intent);
    setInput("");
    if (liveRef.current) liveRef.current.textContent = "Orkestria travaille sur votre demande.";
    void sendMessage(activeId, text)
      .then(() => {
        if (liveRef.current) liveRef.current.textContent = "Orkestria a répondu.";
        setTimeout(() => inputRef.current?.focus(), 30);
      })
      .finally(() => setSendingIntent(null));
  };

  const submitForm = () => {
    const meta = INTENT_META[form.intent];
    const composed = `${meta.label} — Portée : ${form.scope}${form.detail.trim() ? `. Précisions : ${form.detail.trim()}` : ""}.`;
    setFormIntent(null);
    send(composed);
  };

  return (
    <div className="mx-auto grid h-[calc(100dvh-8rem)] max-w-[1200px] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      {/* --- Thread sidebar --- */}
      <aside
        aria-label="Historique des conversations"
        className={`${sidebarOpenMobile ? "block" : "hidden"} lg:block`}
      >
        <div className="card-hover relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_30px_-22px_rgba(20,20,20,0.25)]"
          style={{ backgroundImage: "linear-gradient(180deg,#ffffff 0%,#faf7f2 100%)" }}
        >
          <button
            onClick={createThread}
            className="btn-primary btn-halo w-full !justify-start !px-3 !py-2 !text-[13px]"
            aria-label="Créer une nouvelle conversation"
          >
            <Plus className="h-4 w-4" aria-hidden /> Nouvelle conversation
          </button>

          <label className="mt-3 flex items-center gap-2 rounded-lg border border-line/70 bg-white px-2.5 py-1.5 text-[12px] text-ink-soft focus-within:border-[#ff6c02] focus-within:ring-2 focus-within:ring-[#ff6c02]/25">
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Rechercher une conversation</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-soft focus:outline-none"
            />
          </label>

          {/* Filters & sort */}
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              <Filter className="h-3 w-3" aria-hidden /> Type
            </div>
            <div role="group" aria-label="Filtrer par type" className="flex flex-wrap gap-1">
              {([
                { k: "all", label: "Tous" },
                { k: "audit", label: "Audit" },
                { k: "report", label: "Rapport" },
                { k: "campaign", label: "Campagne" },
                { k: "other", label: "Autres" },
              ] as { k: typeof typeFilter; label: string }[]).map((f) => {
                const active = typeFilter === f.k;
                return (
                  <button
                    key={f.k}
                    type="button"
                    onClick={() => setTypeFilter(f.k)}
                    aria-pressed={active}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40 ${
                      active
                        ? "border-[#ffb066] bg-gradient-to-br from-[#fff5ea] to-[#ffe4c9] text-[#c94a00] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                        : "border-line bg-white text-ink-soft hover:border-[#ffb066] hover:text-ink"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 pt-1 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              <Clock className="h-3 w-3" aria-hidden /> Tri
            </div>
            <div role="group" aria-label="Trier les conversations" className="flex gap-1">
              {([
                { k: "date", label: "Date" },
                { k: "relevance", label: "Pertinence" },
              ] as { k: typeof sortBy; label: string }[]).map((s) => {
                const active = sortBy === s.k;
                const disabled = s.k === "relevance" && !query.trim();
                return (
                  <button
                    key={s.k}
                    type="button"
                    onClick={() => !disabled && setSortBy(s.k)}
                    aria-pressed={active}
                    disabled={disabled}
                    title={disabled ? "Recherchez un terme pour activer le tri par pertinence" : undefined}
                    className={`flex-1 rounded-md border px-2 py-1 text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40 disabled:opacity-45 disabled:cursor-not-allowed ${
                      active
                        ? "border-[#ffb066] bg-gradient-to-br from-[#fff5ea] to-[#ffe4c9] text-[#c94a00] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                        : "border-line bg-white text-ink-soft hover:border-[#ffb066] hover:text-ink"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
            <span>Historique</span>
            <span aria-hidden>{threads.length}</span>
          </div>

          <ul className="mt-1 flex-1 space-y-1 overflow-y-auto pr-1" role="list">
            {filteredThreads.map((t) => {
              const isActive = t.id === activeId;
              const tt = threadType(t);
              const badge = tt
                ? {
                    audit: { label: "Audit", cls: "bg-[#fff1e2] text-[#c94a00] border-[#ffd7ac]" },
                    report: { label: "Rapport", cls: "bg-[#e6f7ee] text-[#0f7a3c] border-[#b6e3c8]" },
                    campaign: { label: "Campagne", cls: "bg-[#ffe6ee] text-[#9e1e4a] border-[#ffbfd1]" },
                  }[tt]
                : null;
              return (
                <li key={t.id} className="group relative">
                  <div
                    className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 transition ${
                      isActive
                        ? "border-[#ffb066] bg-gradient-to-br from-[#fff5ea] to-[#ffe4c9] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                        : "border-transparent bg-white/70 hover:border-line hover:bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectThread(t.id)}
                      aria-current={isActive ? "true" : undefined}
                      className="flex min-w-0 flex-1 items-start gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40 rounded-md"
                    >
                      <MessageSquare className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isActive ? "text-[#c94a00]" : "text-ink-soft"}`} aria-hidden />
                      <div className="min-w-0">
                        <p className={`truncate text-[13px] ${isActive ? "font-semibold text-ink" : "text-ink"}`}>{t.title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {badge && (
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-[1px] text-[10px] font-medium ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                          <span className="truncate text-[11px] text-ink-soft">
                            {t.messages.length} message{t.messages.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteThread(t.id)}
                      aria-label={`Supprimer la conversation ${t.title}`}
                      className="rounded-md p-1 text-ink-soft opacity-0 transition hover:bg-white hover:text-[#a01b1b] focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
            {filteredThreads.length === 0 && (
              <li className="rounded-lg border border-dashed border-line/70 p-3 text-center text-[12px] text-ink-soft">
                Aucune conversation.
              </li>
            )}
          </ul>

          <p className="mt-2 border-t border-line/60 pt-2 text-[11px] text-ink-soft">
            Historique enregistré dans ce navigateur.
          </p>
        </div>
      </aside>

      {/* --- Chat column --- */}
      <section aria-label="Conversation Orkestria" className="flex min-w-0 flex-col">
        <header className="mb-4 flex items-center gap-3 anim-fade-up">
          <button
            type="button"
            onClick={() => setSidebarOpenMobile((v) => !v)}
            aria-label="Afficher l'historique des conversations"
            aria-expanded={sidebarOpenMobile}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40"
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
          </button>
          <span
            aria-hidden
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]"
          >
            <Sparkles className="h-5 w-5" />
            <span className="absolute -inset-1 -z-10 rounded-2xl bg-[#ff6c02]/25 blur-xl anim-pulse-dot" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-wider text-[#c94a00]">Conversation centrale</p>
            <h1 className="mt-0.5 truncate font-display text-[26px] font-semibold text-ink">{active?.title ?? "Orkestria"}</h1>
          </div>
        </header>

        {/* SR-only live region for tool status announcements */}
        <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          className="card-hover relative flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/70 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_38px_-24px_rgba(20,20,20,0.25)]"
          style={{
            backgroundImage:
              "radial-gradient(120% 80% at 0% 0%, rgba(255,140,60,0.08) 0%, rgba(255,140,60,0) 45%), radial-gradient(120% 80% at 100% 100%, rgba(120,80,255,0.06) 0%, rgba(120,80,255,0) 45%), linear-gradient(180deg, #ffffff 0%, #fbfaf7 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.18] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.15 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            }}
          />
          <div className="relative space-y-4">
            {active?.messages.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}

            {/* Typing / tools indicator */}
            {pending && <PendingBlock text={pending.text} tools={pending.tools} />}

            {/* Suggestions + guided form */}
            {!pending && active && active.messages.length === 1 && (
              <div className="space-y-3 pt-2">
                <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.t}
                      type="button"
                      onClick={() => (s.intent ? openForm(s.intent) : send(s.t))}
                      className={`card-hover group relative overflow-hidden rounded-xl border border-white/60 bg-gradient-to-br ${s.grad} p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-16px_rgba(20,20,20,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40`}
                      aria-label={s.t}
                    >
                      <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/40 blur-xl" />
                      <div className="relative flex items-start gap-2.5">
                        <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/85 ${s.ic} ring-1 ring-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]`}>
                          <s.i className="h-4 w-4" />
                        </span>
                        <span className="pt-1 text-[13px] font-medium text-ink">{s.t}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <GuidedLauncher onPick={openForm} />
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-3 flex items-end gap-2 rounded-2xl border border-white/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(20,20,20,0.25)] focus-within:border-[#ff6c02] focus-within:ring-2 focus-within:ring-[#ff6c02]/25 transition"
          style={{ backgroundImage: "linear-gradient(180deg,#ffffff 0%,#faf7f2 100%)" }}
          aria-label="Envoyer un message à Orkestria"
        >
          <button type="button" className="chip-ghost !p-2" aria-label="Joindre un fichier">
            <Paperclip className="h-4 w-4" aria-hidden />
          </button>
          <label className="sr-only" htmlFor="ork-msg">
            Message
          </label>
          <textarea
            id="ork-msg"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={pending ? "Orkestria travaille…" : "Parlez à Orkestria… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)"}
            disabled={!!pending}
            aria-disabled={!!pending}
            className="max-h-32 flex-1 resize-none bg-transparent text-[14px] text-ink placeholder:text-ink-soft focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || !!pending}
            aria-label="Envoyer le message"
            className="btn-primary btn-halo !p-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </section>

      {/* Guided form modal */}
      {formIntent && (
        <GuidedForm
          value={form}
          intent={formIntent}
          onChange={setForm}
          onCancel={() => setFormIntent(null)}
          onSubmit={submitForm}
        />
      )}
    </div>
  );

  function openForm(intent: IntentKey) {
    setForm({ intent, scope: INTENT_META[intent].scopes[1] ?? INTENT_META[intent].scopes[0], detail: "" });
    setFormIntent(intent);
  }
}

// ---------- Sub-components ----------

function MessageBubble({ m }: { m: Msg }) {
  const isUser = m.role === "user";
  return (
    <div className={`anim-fade-up flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <span aria-hidden className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_6px_14px_-6px_rgba(255,108,2,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="max-w-[78%] space-y-2">
        {m.tools && m.tools.length > 0 && <ToolTrace tools={m.tools} defaultOpen={false} />}
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-sm px-4 py-2.5 text-[14px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_-12px_rgba(0,0,0,0.4)] bg-[linear-gradient(180deg,#2a2a2a_0%,#131313_55%,#050505_100%)]"
              : "rounded-2xl rounded-bl-sm border border-white/70 bg-white/90 px-4 py-2.5 text-[14px] text-ink backdrop-blur shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_-12px_rgba(20,20,20,0.2)]"
          }
        >
          {renderText(m.text)}
        </div>
      </div>
    </div>
  );
}

function renderText(text: string) {
  // very light markdown: **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function PendingBlock({ text, tools }: { text: string; tools: ToolCall[] }) {
  const current = tools.find((t) => t.status === "running")?.label ?? tools[tools.length - 1]?.label;
  return (
    <div className="anim-fade-up flex justify-start">
      <span aria-hidden className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_6px_14px_-6px_rgba(255,108,2,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="max-w-[78%] space-y-2">
        <ToolTrace tools={tools} defaultOpen intent={text} />
        <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/70 bg-white/90 px-3 py-2 text-[13px] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_-12px_rgba(20,20,20,0.2)]">
          <span className="flex gap-1" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff6c02] anim-pulse-dot" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff6c02] anim-pulse-dot" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff6c02] anim-pulse-dot" style={{ animationDelay: "300ms" }} />
          </span>
          <span className="text-ink-soft">{current ?? "Orkestria réfléchit"}…</span>
        </div>
      </div>
    </div>
  );
}

function ToolTrace({ tools, defaultOpen = false, intent }: { tools: ToolCall[]; defaultOpen?: boolean; intent?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const done = tools.filter((t) => t.status === "done").length;
  return (
    <div className="rounded-xl border border-white/70 bg-white/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[12px] text-ink hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white">
          <Cog className={`h-3 w-3 ${done < tools.length ? "animate-spin" : ""}`} aria-hidden />
        </span>
        <span className="font-medium">Outils Orkestria</span>
        <span className="ml-auto text-[11px] text-ink-soft">
          {done}/{tools.length}
          {intent ? ` · ${intent}` : ""}
        </span>
      </button>
      {open && (
        <ol className="mt-1.5 space-y-1 pl-1" role="list">
          {tools.map((t, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px]">
              <ToolStatusDot status={t.status} />
              <span className={t.status === "done" ? "text-ink" : "text-ink-soft"}>{t.label}</span>
              <Database className="ml-auto h-3 w-3 text-ink-soft/60" aria-hidden />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ToolStatusDot({ status }: { status: ToolCall["status"] }) {
  if (status === "done")
    return (
      <span aria-label="Terminé" className="flex h-4 w-4 items-center justify-center rounded-full bg-[#12a04d] text-white">
        <Check className="h-2.5 w-2.5" aria-hidden />
      </span>
    );
  if (status === "error")
    return (
      <span aria-label="Erreur" className="flex h-4 w-4 items-center justify-center rounded-full bg-[#c93a12] text-white">
        <X className="h-2.5 w-2.5" aria-hidden />
      </span>
    );
  return (
    <span aria-label="En cours" className="relative flex h-4 w-4 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-[#ff6c02]/25 anim-pulse-dot" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#ff6c02]" />
    </span>
  );
}

function GuidedLauncher({ onPick }: { onPick: (i: IntentKey) => void }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Formulaire guidé</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(INTENT_META) as IntentKey[]).map((k) => {
          const meta = INTENT_META[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              className="card-hover group flex items-center gap-2 rounded-xl border border-line/70 bg-white px-3 py-2 text-left text-[13px] text-ink hover:border-[#ffb066] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40"
              aria-label={`Ouvrir le formulaire ${meta.label}`}
            >
              <span aria-hidden className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${meta.grad} text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.3)]`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GuidedForm({
  value,
  intent,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: FormState;
  intent: IntentKey;
  onChange: (v: FormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const meta = INTENT_META[intent];
  const Icon = meta.icon;
  const [step, setStep] = useState<"edit" | "preview">("edit");

  // Focus trap-lite: focus first control on mount, ESC closes
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 anim-fade-up"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_60px_-24px_rgba(0,0,0,0.35)]"
      >
        <div className={`flex items-center gap-3 bg-gradient-to-br ${meta.grad} p-4 text-white`}>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
              {step === "edit" ? "Étape 1 · Formulaire guidé" : "Étape 2 · Prévisualisation"}
            </p>
            <h2 id="guided-title" className="font-display text-[18px] font-semibold">{meta.label}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer le formulaire"
            className="ml-auto rounded-md p-1.5 text-white/85 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {step === "edit" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep("preview");
          }}
          className="space-y-4 p-5"
        >
          <fieldset>
            <legend className="mb-2 text-[12px] font-semibold text-ink">Type de demande</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(INTENT_META) as IntentKey[]).map((k, i) => {
                const active = value.intent === k;
                const m = INTENT_META[k];
                const KIcon = m.icon;
                return (
                  <button
                    key={k}
                    ref={i === 0 ? firstRef : undefined}
                    type="button"
                    onClick={() => onChange({ ...value, intent: k, scope: m.scopes[1] ?? m.scopes[0] })}
                    aria-pressed={active}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left text-[12px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40 ${
                      active
                        ? "border-[#ffb066] bg-gradient-to-br from-[#fff5ea] to-[#ffe4c9] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                        : "border-line bg-white text-ink-soft hover:border-[#ffb066] hover:text-ink"
                    }`}
                  >
                    <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br ${m.grad} text-white`}>
                      <KIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="scope" className="mb-1.5 block text-[12px] font-semibold text-ink">
              Portée
            </label>
            <select
              id="scope"
              value={value.scope}
              onChange={(e) => onChange({ ...value, scope: e.target.value })}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/25"
            >
              {meta.scopes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="detail" className="mb-1.5 block text-[12px] font-semibold text-ink">
              Précisions <span className="font-normal text-ink-soft">(optionnel)</span>
            </label>
            <textarea
              id="detail"
              value={value.detail}
              onChange={(e) => onChange({ ...value, detail: e.target.value })}
              rows={3}
              placeholder={meta.detailPh}
              className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink-soft focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/25"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className="chip-ghost !py-1.5 !text-[12px]">
              Annuler
            </button>
            <button type="submit" className="btn-primary btn-halo !px-4 !py-2 !text-[13px]">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden /> Prévisualiser
            </button>
          </div>
        </form>
        ) : (
          <div className="space-y-4 p-5">
            <p className="text-[12px] text-ink-soft">
              Vérifiez le récapitulatif avant de lancer la demande à Orkestria.
            </p>
            <dl className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/70 bg-white">
              <div className="flex items-start gap-3 p-3">
                <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.grad} text-white`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Type</dt>
                  <dd className="text-[14px] font-medium text-ink">{meta.label}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff5ea] text-[#c94a00] ring-1 ring-[#ffd7ac]">
                  <Target className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Portée</dt>
                  <dd className="text-[14px] font-medium text-ink">{value.scope}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3">
                <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f0ff] text-[#4a2a9e] ring-1 ring-[#dccdff]">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Précisions</dt>
                  <dd className="whitespace-pre-wrap text-[14px] text-ink">
                    {value.detail.trim() || <span className="italic text-ink-soft">Aucune — Orkestria utilisera les réglages par défaut.</span>}
                  </dd>
                </div>
              </div>
            </dl>
            <div className="rounded-xl border border-[#ffe0c2] bg-[#fff9f1] p-3 text-[12px] text-[#7a4a10]">
              Une fois validée, cette demande sera envoyée dans la conversation et Orkestria commencera l'exécution.
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep("edit")}
                className="chip-ghost !py-1.5 !text-[12px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Modifier
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onCancel} className="chip-ghost !py-1.5 !text-[12px]">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  className="btn-primary btn-halo !px-4 !py-2 !text-[13px]"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden /> Confirmer et lancer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}