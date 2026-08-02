import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Sparkles,
  Plus,
  MessageSquare,
  Trash2,
  Search,
  Filter,
  Clock,
  X,
  ImagePlus,
  Paperclip,
} from "lucide-react";
import { useOrkestriaChat } from "@/lib/orkestria-chat";
import {
  WELCOME,
  SUGGESTIONS,
  INTENT_META,
  detectIntent,
  planTools,
  threadType,
  relevanceScore,
  composeCampaignWizardBrief,
  MessageBubble,
  PendingBlock,
  GuidedLauncher,
  GuidedForm,
  CampaignWizardModal,
  type Thread,
  type IntentKey,
  type FormState,
  type CampaignWizardState,
} from "@/components/orkestria";

export const Route = createFileRoute("/_authenticated/app/orkestria")({ component: OrkestriaPage });

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
  const [pendingImages, setPendingImages] = useState<
    { preview: string; dataUrl: string; name: string }[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | IntentKey | "other">("all");
  const [sortBy, setSortBy] = useState<"date" | "relevance">("date");
  const [sendingIntent, setSendingIntent] = useState<IntentKey | null>(null);
  const pending = isSending
    ? {
        text: sendingIntent ? INTENT_META[sendingIntent].label : "Orkestria analyse votre demande…",
        tools: planTools(sendingIntent),
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
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, pending, activeId]);
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

  const send = (
    raw: string,
    imagesOverride?: { preview: string; dataUrl: string; name: string }[],
  ) => {
    const text = raw.trim();
    const imgs = imagesOverride ?? pendingImages;
    if ((!text && imgs.length === 0) || isSending || !activeId) return;
    const intent = detectIntent(text || "campagne image");
    setSendingIntent(intent);
    const attachments = imgs.map((p) => ({
      kind: "image" as const,
      dataUrl: p.dataUrl,
      name: p.name,
    }));
    setInput("");
    setPendingImages([]);
    if (liveRef.current) liveRef.current.textContent = "Orkestria travaille sur votre demande.";
    void sendMessage(activeId, text || "Voici une image pour la campagne Meta.", attachments)
      .then(() => {
        if (liveRef.current) liveRef.current.textContent = "Orkestria a répondu.";
        setTimeout(() => inputRef.current?.focus(), 30);
      })
      .finally(() => setSendingIntent(null));
  };

  const onPickImage = async (fileList: FileList | null, opts?: { max?: number; appendTo?: "pending" | "none" }) => {
    if (!fileList?.length) return [] as { preview: string; dataUrl: string; name: string }[];
    const max = opts?.max ?? 3;
    const next: { preview: string; dataUrl: string; name: string }[] = [];
    for (const file of Array.from(fileList).slice(0, max)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 2_500_000) {
        window.alert(`« ${file.name} » est trop lourde (max 2,5 Mo).`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("lecture image"));
        reader.readAsDataURL(file);
      });
      next.push({ preview: dataUrl, dataUrl, name: file.name });
    }
    if (next.length && opts?.appendTo !== "none") {
      setPendingImages((prev) => [...prev, ...next].slice(0, max));
    }
    return next;
  };

  const submitForm = () => {
    const composed = INTENT_META[form.intent].compose(form.scope, form.detail.trim());
    setFormIntent(null);
    send(composed);
  };

  const submitCampaignWizard = (wizard: CampaignWizardState) => {
    const composed = composeCampaignWizardBrief(wizard);
    setFormIntent(null);
    send(composed, wizard.images);
  };

  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-[1200px] grid-cols-1 gap-0 lg:grid-cols-[260px_1fr] lg:gap-4 lg:p-4">
      {/* --- Thread sidebar --- */}
      <aside
        aria-label="Historique des conversations"
        className={`${sidebarOpenMobile ? "flex" : "hidden"} min-h-0 flex-col lg:flex`}
      >
        <div
          className="card-hover relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-white/70 p-3 shadow-none lg:rounded-2xl lg:border lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_30px_-22px_rgba(20,20,20,0.25)]"
          style={{ backgroundImage: "linear-gradient(180deg,#ffffff 0%,#faf7f2 100%)" }}
        >
          <button
            onClick={createThread}
            className="btn-primary btn-halo w-full shrink-0 !justify-start !px-3 !py-2 !text-[13px]"
            aria-label="Créer une nouvelle conversation"
          >
            <Plus className="h-4 w-4" aria-hidden /> Nouvelle conversation
          </button>
          <button
            type="button"
            className="mt-2 chip-ghost w-full shrink-0 !justify-center lg:hidden"
            onClick={() => setSidebarOpenMobile(false)}
          >
            Retour au chat
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
            Historique synchronisé sur votre compte.
          </p>
        </div>
      </aside>

      {/* --- Chat column --- */}
      <section
        aria-label="Conversation Orkestria"
        className={`${sidebarOpenMobile ? "hidden" : "flex"} min-h-0 min-w-0 flex-1 flex-col lg:flex`}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line/50 bg-white/80 px-4 py-3 backdrop-blur lg:mb-0 lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-white/70">
          <button
            type="button"
            onClick={() => setSidebarOpenMobile(true)}
            aria-label="Afficher l'historique des conversations"
            aria-expanded={sidebarOpenMobile}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40"
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
          </button>
          <span
            aria-hidden
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#c94a00]">Orkestria</p>
            <h1 className="truncate font-display text-[18px] font-semibold text-ink sm:text-[20px]">
              {active?.title && active.title !== "Nouvelle conversation"
                ? active.title
                : "Votre media buyer"}
            </h1>
          </div>
        </header>

        {/* SR-only live region for tool status announcements */}
        <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white lg:rounded-b-2xl lg:border lg:border-t-0 lg:border-white/70 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_38px_-24px_rgba(20,20,20,0.25)]"
          style={{
            backgroundImage:
              "radial-gradient(120% 80% at 0% 0%, rgba(255,140,60,0.06) 0%, rgba(255,140,60,0) 45%), linear-gradient(180deg, #ffffff 0%, #fbfaf7 100%)",
          }}
        >
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
          >
            <div className="relative mx-auto max-w-[720px] space-y-4">
              {(active?.messages ?? [])
                .filter((m, _idx, arr) => {
                  // Hide welcome once the user has started talking
                  if (m.role === "agent" && m.text === WELCOME && arr.some((x) => x.role === "user")) {
                    return false;
                  }
                  return true;
                })
                .map((m, _i, visible) => {
                  const lastSuggest = [...visible]
                    .reverse()
                    .find((x) => x.role === "agent" && (x.suggestions?.length ?? 0) > 0);
                  return (
                    <MessageBubble
                      key={m.id}
                      m={m}
                      onSuggest={
                        !pending &&
                        m.role === "agent" &&
                        m.suggestions?.length &&
                        lastSuggest?.id === m.id
                          ? (value) => {
                              // Prefill composer when the chip is a prompt to type (ville / rayon / pays…)
                              if (/\s$/.test(value) || /^(pays|ville|rayon)\s*$/i.test(value.trim())) {
                                setInput(value);
                                setTimeout(() => inputRef.current?.focus(), 30);
                                return;
                              }
                              send(value);
                            }
                          : undefined
                      }
                    />
                  );
                })}

              {pending && <PendingBlock text={pending.text} tools={pending.tools} />}

              {!pending && active && active.messages.every((m) => m.role === "agent") && (
                <div className="space-y-3 pt-1">
                  <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.t}
                        type="button"
                        onClick={() => (s.intent ? openForm(s.intent) : send(s.prompt))}
                        className={`card-hover group relative overflow-hidden rounded-xl border border-white/60 bg-gradient-to-br ${s.grad} p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-16px_rgba(20,20,20,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40`}
                        aria-label={s.t}
                      >
                        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/40 blur-xl" />
                        <div className="relative flex items-start gap-2.5">
                          <span
                            aria-hidden
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/85 ${s.ic} ring-1 ring-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]`}
                          >
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

          {/* Composer — always visible at bottom */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="shrink-0 border-t border-line/60 bg-white/95 px-3 py-3 backdrop-blur sm:px-4"
            aria-label="Envoyer un message à Orkestria"
          >
            {pendingImages.length > 0 && (
              <div className="mx-auto mb-2 flex max-w-[720px] flex-wrap gap-2">
                {pendingImages.map((img, i) => (
                  <div key={`${img.name}-${i}`} className="relative h-16 w-16 overflow-hidden rounded-lg border border-line">
                    <img src={img.preview} alt={img.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Retirer l'image"
                      className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
                      onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mx-auto flex max-w-[720px] items-end gap-2 rounded-2xl border border-line/70 bg-white px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus-within:border-[#ff6c02] focus-within:ring-2 focus-within:ring-[#ff6c02]/25">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                multiple
                onChange={(e) => {
                  void onPickImage(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={!!pending}
                aria-label="Joindre une image"
                title="Joindre une image"
                className="mb-0.5 rounded-lg p-2 text-ink-soft hover:bg-[#fff5ea] hover:text-[#c94a00] disabled:opacity-50"
                onClick={() => fileRef.current?.click()}
              >
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
                placeholder={
                  pending
                    ? "Orkestria travaille…"
                    : pendingImages.length
                      ? "Budget/j, pays, URL… puis Envoyer"
                      : "Écrivez ici… (trombone = image)"
                }
                disabled={!!pending}
                aria-disabled={!!pending}
                className="max-h-28 flex-1 resize-none bg-transparent py-1.5 text-[14px] text-ink placeholder:text-ink-soft focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={(!input.trim() && pendingImages.length === 0) || !!pending}
                aria-label="Envoyer le message"
                className="btn-primary btn-halo !p-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingImages.length ? (
                  <ImagePlus className="h-4 w-4" aria-hidden />
                ) : (
                  <ArrowUp className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Guided form / campaign wizard modal */}
      {formIntent === "campaign" ? (
        <CampaignWizardModal
          onCancel={() => setFormIntent(null)}
          onSubmit={submitCampaignWizard}
          pickImages={onPickImage}
        />
      ) : formIntent ? (
        <GuidedForm
          value={form}
          intent={formIntent}
          onChange={setForm}
          onCancel={() => setFormIntent(null)}
          onSubmit={submitForm}
        />
      ) : null}
    </div>
  );

  function openForm(intent: IntentKey) {
    setForm({ intent, scope: INTENT_META[intent].scopes[1] ?? INTENT_META[intent].scopes[0], detail: "" });
    setFormIntent(intent);
  }
}
