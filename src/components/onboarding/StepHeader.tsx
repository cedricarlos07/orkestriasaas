export function StepHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mb-8">
      <p className="text-[12px] font-medium uppercase tracking-wider text-[#ff6c02]">{eyebrow}</p>
      <h1 className="mt-2 font-display text-[28px] font-semibold leading-tight text-ink md:text-[34px]">
        {title}
      </h1>
      {desc && <p className="mt-3 max-w-xl text-[15px] text-ink-soft">{desc}</p>}
    </div>
  );
}

export const inputCls =
  "block w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[14px] text-ink placeholder:text-ink/40 focus:border-[#ff6c02] focus:outline-none focus:ring-2 focus:ring-[#ff6c02]/20";