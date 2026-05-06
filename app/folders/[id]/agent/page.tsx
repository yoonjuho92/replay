import { notFound, redirect } from "next/navigation";
import { BrowserWindow } from "@/app/_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { AgentChat } from "../_components/AgentChat";
import {
  EMPTY_INPUT,
  INPUT_FIELDS,
  INPUT_LABELS,
  type MemoryInput,
} from "../inputs";

function daysSince(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`);
  const diffMs = Date.now() - target.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function buildInitialGreeting(saved: MemoryInput): string {
  const remaining = INPUT_FIELDS.filter(
    (k) => (saved[k] ?? "").trim().length === 0,
  );
  if (remaining.length === INPUT_FIELDS.length) {
    return "안녕하세요. 오늘은 천천히, 그날의 일을 함께 짚어볼게요. 먼저, 가장 후회되는 선택은 어떤 일이었는지 들려주실 수 있을까요?";
  }
  if (remaining.length === 0) {
    return "이미 그날에 대한 12가지 정보를 모두 적어주셨네요. 보태고 싶은 이야기가 있다면 들려주세요. 아니면 바로 다음 단계로 넘어갈게요.";
  }
  const nextLabel = INPUT_LABELS[remaining[0]];
  const filledCount = INPUT_FIELDS.length - remaining.length;
  return `다시 만났어요. 이미 적어주신 ${filledCount}가지는 잘 봤으니 다시 묻지 않을게요. 이어서 '${nextLabel}'부터 조금 더 들려주실 수 있을까요?`;
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AgentPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: folder } = await supabase
    .from("folders")
    .select("id, name, memory_date, memory_inputs")
    .eq("id", id)
    .maybeSingle();

  if (!folder) notFound();

  const days = folder.memory_date ? daysSince(folder.memory_date) : null;
  const savedInputs = folder.memory_inputs as Partial<MemoryInput> | null;
  const initialInputs: MemoryInput = INPUT_FIELDS.reduce(
    (acc, key) => ({ ...acc, [key]: savedInputs?.[key] ?? "" }),
    EMPTY_INPUT,
  );
  const initialGreeting = buildInitialGreeting(initialInputs);

  return (
    <BrowserWindow title="새로고침" showSignOut fill>
      <AgentChat
        folderId={folder.id}
        folderName={folder.name}
        days={days}
        initialGreeting={initialGreeting}
      />
    </BrowserWindow>
  );
}
