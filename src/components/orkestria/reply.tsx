import { useState, type ReactNode } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Cog,
  Database,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { Msg, ToolCall } from "@/components/orkestria/types";

export type ReplySectionKind = "situation" | "problems" | "opportunities" | "action" | "body";

export type ReplySection = { kind: ReplySectionKind; title?: string; body: string };

const SECTION_RE =
  /^\*\*(Probl[eè]mes?[^\n:*]*|Opportunit[eé]s?[^\n:*]*|Premi[eè]re action[^\n:*]*|Prochaine action[^\n:*]*|Action recommand[eé]e[^\n:*]*|Synth[eè]se[^\n:*]*|Contexte[^\n:*]*)\s*:?\*\*\s*:?\s*/i;

function classifySection(title: string): ReplySectionKind {
  const t = title.toLowerCase();
  if (/probl/.test(t)) return "problems";
  if (/opportunit/.test(t)) return "opportunities";
  if (/action|prochaine/.test(t)) return "action";
  if (/synth|contexte/.test(t)) return "situation";
  return "body";
}

/** Split agent replies into situation + themed cards when section headers are present. */
export function parseReplySections(text: string): ReplySection[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: ReplySection[] = [];
  let cur: ReplySection = { kind: "situation", body: "" };

  const push = () => {
    if (cur.body.trim()) sections.push({ ...cur, body: cur.body.trim() });
  };

  for (const line of lines) {
    const m = line.match(SECTION_RE);
    if (m) {
      push();
      const title = m[1].replace(/\s*:$/, "").trim();
      const rest = line.slice(m[0].length).trim();
      cur = { kind: classifySection(title), title, body: rest ? `${rest}\n` : "" };
      continue;
    }
    cur.body += `${line}\n`;
  }
  push();

  const hasCards = sections.some((s) => s.kind === "problems" || s.kind === "opportunities" || s.kind === "action");
  if (!hasCards) return [{ kind: "body", body: text.trim() }];
  return sections;
}

export function AgentReply({ text }: { text: string }) {
  const sections = parseReplySections(text);
  return (
    <div className="space-y-2.5">
      {sections.map((s, i) => {
        if (s.kind === "problems") {
          return (
            <ReplyCard
              key={i}
              title={s.title ?? "Problèmes à corriger"}
              icon={AlertTriangle}
              tone="warn"
              body={s.body}
            />
          );
        }
        if (s.kind === "opportunities") {
          return (
            <ReplyCard
              key={i}
              title={s.title ?? "Opportunités"}
              icon={Lightbulb}
              tone="ok"
              body={s.body}
            />
          );
        }
        if (s.kind === "action") {
          return (
            <ReplyCard
              key={i}
              title={s.title ?? "Action recommandée"}
              icon={ArrowRight}
              tone="action"
              body={s.body}
            />
          );
        }
        return (
          <div
            key={i}
            className="rounded-2xl rounded-bl-sm border border-[#eadfce] bg-white px-4 py-3 text-[14px] text-ink shadow-[0_6px_18px_-14px_rgba(20,20,20,0.28)]"
          >
            {renderMarkdown(s.body)}
          </div>
        );
      })}
    </div>
  );
}

export function ReplyCard({
  title,
  icon: Icon,
  tone,
  body,
}: {
  title: string;
  icon: LucideIcon;
  tone: "warn" | "ok" | "action";
  body: string;
}) {
  const toneCls =
    tone === "warn"
      ? {
          wrap: "border-[#f0c9a8] bg-[#fff8f1]",
          icon: "bg-[#fff1e2] text-[#c94a00]",
          title: "text-[#9a3d00]",
        }
      : tone === "ok"
        ? {
            wrap: "border-[#b6e3c8] bg-[#f3fbf6]",
            icon: "bg-[#e6f7ee] text-[#0f7a3c]",
            title: "text-[#0f7a3c]",
          }
        : {
            wrap: "border-[#ffb066] bg-gradient-to-br from-[#fff5ea] to-[#ffe8d4]",
            icon: "bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white",
            title: "text-[#c94a00]",
          };

  return (
    <section className={`rounded-2xl border px-3.5 py-3 ${toneCls.wrap}`}>
      <header className="mb-2 flex items-center gap-2">
        <span aria-hidden className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneCls.icon}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className={`text-[12px] font-semibold uppercase tracking-wide ${toneCls.title}`}>{title}</h3>
      </header>
      <div className="text-[13.5px] text-ink pl-0.5">{renderMarkdown(body, { listTone: tone })}</div>
    </section>
  );
}

export function renderInline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  );
}

/** Markdown-lite: paragraphs, bullets, numbered lists, **bold**. */
export function renderMarkdown(text: string, opts?: { listTone?: "warn" | "ok" | "action" }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    const ListTag = ordered ? "ol" : "ul";
    const marker =
      opts?.listTone === "warn"
        ? "marker:text-[#c94a00]"
        : opts?.listTone === "ok"
          ? "marker:text-[#0f7a3c]"
          : opts?.listTone === "action"
            ? "marker:text-[#c94a00]"
            : "marker:text-ink-soft";
    blocks.push(
      <ListTag
        key={`list-${blocks.length}`}
        className={`my-1 space-y-1.5 pl-5 ${ordered ? "list-decimal" : "list-disc"} ${marker}`}
      >
        {items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInline(item, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </ListTag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) {
      if (list?.ordered) flushList();
      list ??= { ordered: false, items: [] };
      list.items.push(bullet[1]);
      continue;
    }
    if (numbered) {
      if (list && !list.ordered) flushList();
      list ??= { ordered: true, items: [] };
      list.items.push(numbered[1]);
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed text-[14px]">
        {renderInline(line, `p-${blocks.length}`)}
      </p>,
    );
  }
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}

export function MessageBubble({
  m,
  onSuggest,
}: {
  m: Msg;
  onSuggest?: (value: string) => void;
}) {
  const isUser = m.role === "user";
  return (
    <div className={`anim-fade-up flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <span aria-hidden className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white shadow-[0_6px_14px_-6px_rgba(255,108,2,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      )}
      <div className={`space-y-2 ${isUser ? "max-w-[78%]" : "max-w-[min(100%,640px)] w-full"}`}>
        {m.tools && m.tools.length > 0 && <ToolTrace tools={m.tools} defaultOpen={false} />}
        {isUser ? (
          <div className="rounded-2xl rounded-br-sm px-4 py-2.5 text-[14px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_-12px_rgba(0,0,0,0.4)] bg-[linear-gradient(180deg,#2a2a2a_0%,#131313_55%,#050505_100%)]">
            {renderInline(m.text, "u")}
          </div>
        ) : (
          <>
            <AgentReply text={m.text} />
            {m.suggestions && m.suggestions.length > 0 && onSuggest && (
              <SuggestionButtons suggestions={m.suggestions} onPick={onSuggest} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function SuggestionButtons({
  suggestions,
  onPick,
}: {
  suggestions: { label: string; value: string }[];
  onPick: (value: string) => void;
}) {
  const numbered = suggestions.length >= 3;
  return (
    <ol className="overflow-hidden rounded-2xl border border-[#eadfce] bg-white shadow-[0_6px_18px_-14px_rgba(20,20,20,0.28)]">
      {suggestions.map((s, i) => (
        <li key={`${s.value}-${i}`} className={i > 0 ? "border-t border-line/60" : ""}>
          <button
            type="button"
            onClick={() => onPick(s.value)}
            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] text-ink transition hover:bg-[#fff5ea] focus:outline-none focus-visible:bg-[#fff5ea] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff6c02]/35"
          >
            {numbered ? (
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0ebe3] text-[12px] font-semibold text-ink-soft"
              >
                {i + 1}
              </span>
            ) : (
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff8a2b] to-[#ff5e00] text-white"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="min-w-0 flex-1 font-medium leading-snug">{s.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#c94a00]" aria-hidden />
          </button>
        </li>
      ))}
    </ol>
  );
}

export function PendingBlock({ text, tools }: { text: string; tools: ToolCall[] }) {
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

export function ToolTrace({ tools, defaultOpen = false, intent }: { tools: ToolCall[]; defaultOpen?: boolean; intent?: string }) {
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

export function ToolStatusDot({ status }: { status: ToolCall["status"] }) {
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
