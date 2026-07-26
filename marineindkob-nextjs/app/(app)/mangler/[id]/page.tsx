import { NeedForm } from "@/components/NeedForm";

export default async function EditManglePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <NeedForm needId={id} />
    </div>
  );
}
