import { notFound, redirect } from "next/navigation";
import { BrowserWindow } from "@/app/_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import type { MemoryChoices } from "./actions";
import { MemoryForm } from "./_components/MemoryForm";

function daysSince(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`);
  const diffMs = Date.now() - target.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MemoryPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: folder } = await supabase
    .from("folders")
    .select(
      "id,name,memory_date,memory_text,memory_people,memory_place,memory_outcome,memory_generated,memory_choices",
    )
    .eq("id", id)
    .maybeSingle();

  if (!folder) notFound();

  const days = folder.memory_date ? daysSince(folder.memory_date) : null;
  const initialChoices = (folder.memory_choices as MemoryChoices | null) ?? null;

  return (
    <BrowserWindow title="새로고침">
      <div className="flex w-full flex-col gap-6">
        <MemoryForm
          folderId={folder.id}
          folderName={folder.name}
          days={days}
          initial={{
            regret: folder.memory_text ?? "",
            people: folder.memory_people ?? "",
            place: folder.memory_place ?? "",
            outcome: folder.memory_outcome ?? "",
            generated: folder.memory_generated ?? "",
          }}
          initialChoices={initialChoices}
        />
      </div>
    </BrowserWindow>
  );
}
