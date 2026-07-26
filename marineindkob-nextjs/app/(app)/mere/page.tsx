import Link from "next/link";

const ITEMS = [
  ["/tilbud", "🏷️", "Ugens tilbud", "Se og registrér tilbud fra butikker"],
  ["/forslag", "💡", "Indkøbsforslag", "Køb nu, køb kun det nødvendige, eller vent"],
  ["/arrangementer", "🎉", "Arrangementer", "Planlæg indkøb til kommende begivenheder"],
  ["/historik", "🕘", "Historik", "Tidligere indkøb, priser og forbrug"],
  ["/admin", "🔐", "Admin", "Brugere, produkter, butikker og indstillinger"]
] as const;

export default function MerePage() {
  return (
    <div>
      {ITEMS.map(([href, icon, label, desc]) => (
        <Link key={href} href={href} className="card mb-3.5 flex items-center gap-3.5">
          <div className="text-2xl">{icon}</div>
          <div>
            <div className="font-serif font-bold text-navy text-base">{label}</div>
            <div className="text-xs text-[#8A8A8A]">{desc}</div>
          </div>
          <div className="ml-auto text-[#8A8A8A]">→</div>
        </Link>
      ))}
    </div>
  );
}
