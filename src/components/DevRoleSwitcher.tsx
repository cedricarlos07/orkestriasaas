import { useEffect, useState } from "react";
import { ShieldAlert, ChevronUp, ChevronDown } from "lucide-react";
import { ADMIN_ROLES, getAdminRole, setAdminRole, type AdminRole } from "@/lib/admin-store";

export function DevRoleSwitcher() {
  const [role, setRole] = useState<AdminRole>("super_admin");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setRole(getAdminRole());
  }, []);

  if (!mounted) return null;

  const apply = (r: AdminRole) => {
    setAdminRole(r);
    setRole(r);
    setOpen(false);
    if (!location.pathname.startsWith("/admin")) location.href = "/admin";
  };

  const current = ADMIN_ROLES.find((r) => r.value === role) ?? ADMIN_ROLES[0];

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-sans" style={{ fontFamily: "Manrope, system-ui, sans-serif" }}>
      {open && (
        <div className="mb-2 w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#111114] text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff8a3d]">Dev · Rôle admin</p>
            <p className="mt-0.5 text-[12px] text-white/60">Bascule sans passer par localStorage</p>
          </div>
          <ul className="p-1.5">
            {ADMIN_ROLES.map((r) => {
              const active = r.value === role;
              return (
                <li key={r.value}>
                  <button
                    onClick={() => apply(r.value)}
                    className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition ${active ? "bg-white/10" : "hover:bg-white/[0.05]"}`}
                  >
                    <span className={`mt-1 h-2 w-2 rounded-full ${active ? "bg-[#ff6c02]" : "bg-white/25"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-white">{r.label}</span>
                      <span className="block text-[11px] text-white/50">{r.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-white/10 px-4 py-2 text-[10.5px] text-white/40">
            Mode démo — visible uniquement en preview.
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-[#111114] px-3.5 py-2 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] hover:bg-[#1a1a1f]"
        aria-label="Changer de rôle admin"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#ff6c02] to-[#ff8a3d]">
          <ShieldAlert className="h-3.5 w-3.5 text-white" />
        </span>
        <span className="text-[12px] font-medium">{current.label}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-white/60" /> : <ChevronUp className="h-3.5 w-3.5 text-white/60" />}
      </button>
    </div>
  );
}