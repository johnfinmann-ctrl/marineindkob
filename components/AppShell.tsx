"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMembership } from "./MembershipContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/forside", ic: "⚓", label: "Forside" },
  { href: "/mangler", ic: "📋", label: "Mangler" },
  { href: "/indkobsliste", ic: "🛒", label: "Indkøbsliste" },
  { href: "/lager", ic: "📦", label: "Lager" }
];
const MORE_ITEMS = [
  { href: "/tilbud", ic: "🏷️", label: "Ugens tilbud" },
  { href: "/forslag", ic: "💡", label: "Indkøbsforslag" },
  { href: "/arrangementer", ic: "🎉", label: "Arrangementer" },
  { href: "/historik", ic: "🕘", label: "Historik" },
  { href: "/admin", ic: "🔐", label: "Admin" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const membership = useMembership();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isMoreActive = MORE_ITEMS.some((i) => pathname?.startsWith(i.href));

  return (
    <div className="max-w-[1180px] mx-auto min-h-screen flex">
      {/* Sidebar — tablet/desktop */}
      <aside className="hidden md:block w-[230px] bg-navy text-warm-white p-5 shrink-0 min-h-screen">
        <div className="flex items-center gap-2 mb-1">
          <AnchorIcon />
          <div>
            <div className="font-serif text-xl font-bold">MarineIndkøb</div>
            <div className="text-[10px] tracking-wider uppercase text-gold-light">
              Ebeltoft Marineforening
            </div>
          </div>
        </div>
        <div className="wave-rule mb-5" />
        <div className="text-gold-light text-[11px] tracking-wider uppercase mb-2 mt-2">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => (
          <SideLink key={item.href} {...item} active={pathname === item.href} />
        ))}
        <div className="text-gold-light text-[11px] tracking-wider uppercase mb-2 mt-4">Mere</div>
        {MORE_ITEMS.map((item) => (
          <SideLink key={item.href} {...item} active={pathname?.startsWith(item.href) ?? false} />
        ))}
        <div className="mt-6 pt-4 border-t border-white/10 text-sm">
          <div className="font-bold">{membership.fullName}</div>
          <div className="text-white/60 text-xs mb-3">
            {membership.role === "administrator" ? "Administrator" : "Indkøber"}
          </div>
          <button onClick={handleLogout} className="text-gold-light text-xs underline">
            Log ud
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Topbar */}
        <div className="bg-navy text-warm-white px-4 pt-3.5 pb-4 sticky top-0 z-30 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AnchorIcon />
              <span className="font-serif text-lg font-bold">MarineIndkøb</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 border border-gold-light/35 rounded-full px-3 py-1.5 text-sm">
              <span className="w-6 h-6 rounded-full bg-gold text-navy-dark flex items-center justify-center text-xs font-bold">
                {membership.initials}
              </span>
              {membership.fullName}
            </div>
          </div>
          <div className="wave-rule mt-2.5" />
        </div>

        <div className="flex-1 px-4 md:px-8 py-4 md:py-6 pb-24 md:pb-12">{children}</div>

        {/* Bottom nav — mobile only */}
        <nav className="md:hidden fixed left-0 right-0 bottom-0 max-w-[1180px] mx-auto bg-navy flex shadow-[0_-2px_12px_rgba(0,0,0,0.15)] z-40 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map((item) => (
            <BottomNavButton key={item.href} {...item} active={pathname === item.href} />
          ))}
          <Link
            href="/mere"
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] ${
              isMoreActive ? "text-gold-light" : "text-white/60"
            }`}
          >
            <span className="text-[19px]">⋯</span>
            <span>Mere</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}

function SideLink({ href, ic, label, active }: { href: string; ic: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14.5px] mb-0.5 ${
        active ? "bg-gold-light/20 text-white font-semibold" : "text-white/70"
      }`}
    >
      <span>{ic}</span>
      <span>{label}</span>
    </Link>
  );
}

function BottomNavButton({ href, ic, label, active }: { href: string; ic: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] ${
        active ? "text-gold-light" : "text-white/60"
      }`}
    >
      <span className="text-[19px]">{ic}</span>
      <span>{label}</span>
    </Link>
  );
}

function AnchorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 shrink-0">
      <circle cx="12" cy="5" r="2.1" stroke="#C9AD6B" strokeWidth="1.6" />
      <path d="M12 7.2V20" stroke="#C9AD6B" strokeWidth="1.6" />
      <path d="M7 11H17" stroke="#C9AD6B" strokeWidth="1.6" />
      <path
        d="M4.5 14C4.5 17.5 8 20 12 20C16 20 19.5 17.5 19.5 14"
        stroke="#C9AD6B"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
