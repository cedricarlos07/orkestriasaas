export function printHtmlAsPdf(title: string, bodyHtml: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; color: #0b0b0f; margin: 0; padding: 32px; }
    h1 { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; font-size: 22px; margin: 0 0 4px; }
    h2 { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; font-size: 15px; margin: 24px 0 8px; }
    p { margin: 4px 0; font-size: 13px; line-height: 1.5; }
    .muted { color: #6b7280; font-size: 12px; }
    .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; background: #fff6ee; color: #ff6c02; font-size: 11px; font-weight:600; text-transform: uppercase; letter-spacing: .06em; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; font-weight: 600; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; margin-top: 10px; }
    .bar { height: 8px; border-radius: 999px; background: #f3f4f6; overflow: hidden; }
    .bar > span { display:block; height: 100%; background: #ff6c02; }
    .row { display:flex; justify-content: space-between; align-items:center; gap: 12px; font-size:13px; padding: 4px 0; }
    .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    footer { margin-top: 32px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print { body { padding: 20px; } }
  </style></head><body>${bodyHtml}
  <footer>Généré par Orkestria · ${new Date().toLocaleString("fr-FR")}</footer>
  <script>window.onload = () => { setTimeout(() => window.print(), 250); };</script>
  </body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}