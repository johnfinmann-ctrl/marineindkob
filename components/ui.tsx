export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card mb-3.5 ${className}`}>{children}</div>;
}

export function Pill({
  children,
  color = "grey"
}: {
  children: React.ReactNode;
  color?: "green" | "yellow" | "red" | "blue" | "grey";
}) {
  const map: Record<string, string> = {
    green: "bg-green-bg text-green",
    yellow: "bg-yellow-bg text-yellow",
    red: "bg-red-bg text-red",
    blue: "bg-blue-bg text-blue",
    grey: "bg-[#eee] text-[#8A8A8A]"
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${map[color]}`}>
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`btn-primary rounded-xl px-4 py-3 font-bold text-[15px] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function GoldButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`btn-gold rounded-xl px-4 py-3 font-bold text-[15px] disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
}

export function OutlineButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`bg-transparent border-[1.5px] border-navy text-navy rounded-xl px-3.5 py-2 text-sm font-bold disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="text-center py-10 px-4 text-[#8A8A8A]">
      <div className="text-4xl mb-2">{icon}</div>
      <div className="font-bold text-navy mb-1">{title}</div>
      <div>{subtitle}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="font-serif font-bold text-navy text-[16.5px] mt-5 mb-2.5 flex items-center justify-between">
      <span>{children}</span>
      {action}
    </div>
  );
}
