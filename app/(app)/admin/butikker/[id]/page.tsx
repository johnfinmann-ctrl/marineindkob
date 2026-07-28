import Link from "next/link";
import { StoreForm } from "@/components/StoreForm";

export default async function RedigerButikPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <Link href="/admin/butikker" className="text-sm text-gold font-semibold mb-4 inline-block">
        ← Butikker
      </Link>
      <StoreForm storeId={id} />
    </div>
  );
}
