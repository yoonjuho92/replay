import { notFound, redirect } from "next/navigation";
import { BrowserWindow } from "@/app/_components/BrowserWindow";
import { createClient } from "@/lib/supabase/server";
import { AgentChat } from "../_components/AgentChat";
import {
  type CategoryConfig,
  getCategoryByName,
  normalizeAnswers,
  remainingFields,
} from "../../categories";

function buildInitialGreeting(
  category: CategoryConfig,
  saved: Record<string, string>,
): string {
  const remaining = remainingFields(category, saved);
  if (remaining.length === category.questions.length) {
    const first = category.questions[0];
    return `안녕하세요. ${category.name}에 대한 이야기를 천천히 함께 풀어볼게요. 먼저, ${first.question} 편하게 들려주세요.`;
  }
  if (remaining.length === 0) {
    return "이미 모든 항목에 답해 주셨네요. 보태고 싶은 이야기가 있다면 들려주세요. 아니면 바로 글쓰기 화면으로 넘어갈게요.";
  }
  const next = remaining[0];
  const filledCount = category.questions.length - remaining.length;
  return `다시 만났어요. 이미 적어주신 ${filledCount}개는 잘 봤으니 다시 묻지 않을게요. 이어서 '${next.shortLabel}'부터 들려주실 수 있을까요?`;
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
    .select("id, name, memory_inputs")
    .eq("id", id)
    .maybeSingle();

  if (!folder) notFound();
  const category = getCategoryByName(folder.name);
  if (!category) notFound();
  if (!category.available) redirect(`/folders/${folder.id}`);

  const answers = normalizeAnswers(
    category,
    (folder.memory_inputs ?? {}) as Record<string, unknown>,
  );
  const initialGreeting = buildInitialGreeting(category, answers);

  return (
    <BrowserWindow title={folder.name} showSignOut fill>
      <AgentChat
        folderId={folder.id}
        initialGreeting={initialGreeting}
      />
    </BrowserWindow>
  );
}
