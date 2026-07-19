// Shared building blocks
function SkHeader({ badge = 40, title = 64, sub = 80 }: { badge?: number; title?: number; sub?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="skeleton h-11 w-11 !rounded-2xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3" style={{ width: `${badge * 4}px`, maxWidth: "100%" }} />
        <div className="skeleton h-6" style={{ width: `${title * 4}px`, maxWidth: "100%" }} />
        <div className="skeleton h-3" style={{ width: `${sub * 4}px`, maxWidth: "100%" }} />
      </div>
    </div>
  );
}

function SkKpiRow({ n = 4 }: { n?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 md:grid-cols-${n}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white p-4 ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-14px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-between">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-7 !rounded-full" />
          </div>
          <div className="skeleton mt-3 h-7 w-28" />
          <div className="skeleton mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function SkFilters({ chips = 5 }: { chips?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-line/60">
      <div className="skeleton h-9 w-56 !rounded-full" />
      {Array.from({ length: chips }).map((_, i) => (
        <div key={i} className="skeleton h-7 !rounded-full" style={{ width: `${60 + (i % 3) * 20}px` }} />
      ))}
      <div className="ml-auto skeleton h-9 w-28 !rounded-full" />
    </div>
  );
}

function SkTable({ cols = 5, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line/60">
      <div className="grid gap-3 border-b border-line/60 bg-gradient-to-br from-[#fdfaf4] to-white px-5 py-3" style={{ gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-3" style={{ width: i === 0 ? "60%" : "50%" }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid items-center gap-3 border-t border-line/50 px-5 py-3.5"
          style={{ gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)` }}
        >
          <div className="flex items-center gap-2.5">
            <div className="skeleton h-8 w-8 !rounded-full" />
            <div className="skeleton h-3 flex-1" style={{ maxWidth: `${140 - (r % 3) * 12}px` }} />
          </div>
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <div key={c} className="skeleton h-3" style={{ width: c === cols - 2 ? "40%" : "70%" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkAside() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-3">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-4/5" />
        <div className="skeleton h-9 w-32 !rounded-full" />
      </div>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-3">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-24 w-full" />
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1200px] space-y-6" aria-busy="true" aria-live="polite">
      {children}
    </div>
  );
}

// Per-route skeletons
function TodaySkeleton() {
  return (
    <Shell>
      <SkHeader />
      <SkKpiRow n={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-4">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-48 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-8 w-8 !rounded-full" />
                <div className="skeleton h-3 flex-1" />
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
        <SkAside />
      </div>
    </Shell>
  );
}

function CampaignsListSkeleton() {
  return (
    <Shell>
      <SkHeader />
      <SkFilters chips={4} />
      <SkTable cols={7} rows={7} />
    </Shell>
  );
}

function CampaignDetailSkeleton() {
  return (
    <Shell>
      <SkHeader title={80} />
      <SkKpiRow n={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-4">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-64 w-full" />
        </div>
        <SkAside />
      </div>
    </Shell>
  );
}

function LeadsSkeleton() {
  return (
    <Shell>
      <SkHeader />
      <SkKpiRow n={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <SkTable cols={4} rows={7} />
        <SkAside />
      </div>
    </Shell>
  );
}

function RunsSkeleton() {
  return (
    <Shell>
      <SkHeader />
      <SkFilters chips={3} />
      <SkTable cols={6} rows={8} />
    </Shell>
  );
}

function ChatSkeleton() {
  return (
    <Shell>
      <SkHeader title={70} />
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-4 min-h-[420px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
            <div className={`skeleton h-16 ${i % 2 === 0 ? "w-[60%]" : "w-[45%]"}`} />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-3 ring-1 ring-line/60 flex items-center gap-3">
        <div className="skeleton h-10 flex-1 !rounded-full" />
        <div className="skeleton h-10 w-10 !rounded-full" />
      </div>
    </Shell>
  );
}

function ReportsSkeleton() {
  return (
    <Shell>
      <SkHeader />
      <SkKpiRow n={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-3">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-40 w-full" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

function ConnectionsSkeleton() {
  return (
    <Shell>
      <SkHeader />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 !rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-24" />
              </div>
            </div>
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-9 w-28 !rounded-full" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

function SettingsSkeleton() {
  return (
    <Shell>
      <SkHeader />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line/60 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full !rounded-lg" />
          ))}
        </div>
        <div className="rounded-2xl bg-white p-6 ring-1 ring-line/60 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-10 w-full !rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function AuditSkeleton() {
  return (
    <Shell>
      <SkHeader />
      <SkKpiRow n={3} />
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-3">
        <div className="skeleton h-4 w-56" />
        <div className="skeleton h-64 w-full" />
      </div>
    </Shell>
  );
}

function AgencySkeleton() {
  return (
    <Shell>
      <SkHeader />
      <SkFilters chips={3} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 ring-1 ring-line/60 space-y-3">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/5" />
            <div className="flex gap-2">
              <div className="skeleton h-7 w-20 !rounded-full" />
              <div className="skeleton h-7 w-24 !rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function DashboardSkeleton({ pathname }: { pathname: string }) {
  if (pathname === "/app") return <TodaySkeleton />;
  if (pathname === "/app/campaigns" || pathname === "/app/campaigns/") return <CampaignsListSkeleton />;
  if (pathname.startsWith("/app/campaigns/new")) return <ChatSkeleton />;
  if (pathname.startsWith("/app/campaigns/")) return <CampaignDetailSkeleton />;
  if (pathname === "/app/leads") return <LeadsSkeleton />;
  if (pathname === "/app/runs" || pathname.startsWith("/app/runs/")) return <RunsSkeleton />;
  if (pathname === "/app/reports") return <ReportsSkeleton />;
  if (pathname === "/app/audit") return <AuditSkeleton />;
  if (pathname === "/app/connections") return <ConnectionsSkeleton />;
  if (pathname === "/app/settings") return <SettingsSkeleton />;
  if (pathname === "/app/agency") return <AgencySkeleton />;
  if (pathname === "/app/orkestria" || pathname === "/app/automations" || pathname === "/app/creations") return <ChatSkeleton />;
  return <TodaySkeleton />;
}