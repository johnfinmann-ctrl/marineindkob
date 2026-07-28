import Link from "next/link";
import { StoreForm } from "@/components/StoreForm";

export default function NyButikPage() {
  return (
    <div>
      <Link href="/admin/butikker" className="text-sm text-gold font-semibold mb-4 inline-block">
        ← Butikker
      </Link>
      <StoreForm />
    </div>
  );
}
