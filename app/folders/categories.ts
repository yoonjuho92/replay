export type CategorySlug = "one-meal" | "grateful-person" | "return-time";

export type CategoryConfig = {
  slug: CategorySlug;
  name: string;
  available: boolean;
  /** 이 자서전 챕터가 어떤 이야기를 담는지 한 줄 설명 */
  theme: string;
  /** 대화를 여는 첫 질문 */
  opening: string;
  /** 인터뷰 에이전트의 시스템 프롬프트에 들어갈, 주제별 안내 */
  interviewGuide: string;
  agentPersona: string;
  writingCoachPersona: string;
};

/** 예전 데이터 호환용: 과거에는 { story: "..." } 형태로 저장했다. */
const LEGACY_STORY_KEY = "story";

const ONE_MEAL_CONFIG: CategoryConfig = {
  slug: "one-meal",
  name: "내 인생의 한 끼",
  available: true,
  theme: "내 인생에서 잊을 수 없는 한 끼의 식사에 대한 이야기",
  opening:
    "살면서 유난히 마음에 남아 있는 한 끼가 있다면, 어떤 식사였는지 편하게 들려주시겠어요?",
  interviewGuide: [
    "이 챕터의 주제는 '내 인생의 한 끼'입니다. 사용자의 인생에서 잊히지 않는 한 번의 식사를 생생하게 떠올리도록 도와주세요.",
    "다음과 같은 결을 자연스럽게 끌어내면 좋습니다(체크리스트가 아니라, 대화 흐름에 맞춰 골라 물어보세요):",
    "- 무엇을 먹었는지, 어떤 맛과 냄새였는지",
    "- 그 식사가 언제, 어디에서 있었는지",
    "- 누구와 함께였는지, 그 사람과의 관계",
    "- 왜 그 한 끼가 지금까지 마음에 남아 있는지, 그때의 감정",
  ].join("\n"),
  agentPersona:
    "당신은 사용자의 인생에서 잊을 수 없는 한 끼의 기억을 따뜻하고 진솔한 대화로 함께 더듬어 가는 자서전 인터뷰어입니다.",
  writingCoachPersona:
    "당신은 사용자가 '내 인생의 한 끼' 기억을 한 편의 짧은 자서전 글로 정리하도록 돕는 글쓰기 코치입니다.",
};

const GRATEFUL_PERSON_CONFIG: CategoryConfig = {
  slug: "grateful-person",
  name: "감사한 사람",
  available: true,
  theme: "내가 살면서 가장 감사한 한 사람에 대한 이야기",
  opening:
    "살아오면서 마음 깊이 감사한 사람이 있다면, 그 사람이 어떤 분인지 편하게 들려주시겠어요?",
  interviewGuide: [
    "이 챕터의 주제는 '감사한 사람'입니다. 사용자가 인생에서 깊이 감사하는 한 사람을 또렷이 떠올리도록 도와주세요.",
    "다음과 같은 결을 자연스럽게 끌어내면 좋습니다(체크리스트가 아니라, 대화 흐름에 맞춰 골라 물어보세요):",
    "- 그 사람이 누구인지, 사용자와 어떤 관계인지",
    "- 그 사람에게 감사하게 된 구체적인 일이나 장면",
    "- 그 사람이 사용자에게 어떤 의미였는지",
    "- 지금 그 사람에게 전하고 싶은 말",
  ].join("\n"),
  agentPersona:
    "당신은 사용자가 인생에서 가장 감사한 한 사람을 따뜻하고 진솔한 대화로 함께 떠올리는 자서전 인터뷰어입니다.",
  writingCoachPersona:
    "당신은 사용자가 '감사한 사람' 이야기를 한 편의 짧은 자서전 글로 정리하도록 돕는 글쓰기 코치입니다.",
};

const RETURN_TIME_CONFIG: CategoryConfig = {
  slug: "return-time",
  name: "돌아가고 싶은 시간",
  available: true,
  theme: "다시 돌아가고 싶은 인생의 한 시절에 대한 이야기",
  opening:
    "다시 돌아갈 수 있다면 머물고 싶은 시간이 있나요? 어떤 시절인지 편하게 들려주시겠어요?",
  interviewGuide: [
    "이 챕터의 주제는 '돌아가고 싶은 시간'입니다. 사용자가 다시 돌아가고 싶은 인생의 한 시절을 생생하게 떠올리도록 도와주세요.",
    "다음과 같은 결을 자연스럽게 끌어내면 좋습니다(체크리스트가 아니라, 대화 흐름에 맞춰 골라 물어보세요):",
    "- 그 시간이 언제였는지, 그때의 삶은 어땠는지",
    "- 그 시절 곁에 누가 있었는지",
    "- 그때의 풍경·소리·냄새 같은 구체적인 감각",
    "- 왜 그 시간으로 돌아가고 싶은지, 무엇이 가장 그리운지",
  ].join("\n"),
  agentPersona:
    "당신은 사용자가 다시 돌아가고 싶은 인생의 한 시절을 따뜻하고 진솔한 대화로 함께 더듬어 가는 자서전 인터뷰어입니다.",
  writingCoachPersona:
    "당신은 사용자가 '돌아가고 싶은 시간' 이야기를 한 편의 짧은 자서전 글로 정리하도록 돕는 글쓰기 코치입니다.",
};

export const CATEGORIES: CategoryConfig[] = [
  ONE_MEAL_CONFIG,
  GRATEFUL_PERSON_CONFIG,
  RETURN_TIME_CONFIG,
];

export const SYSTEM_FOLDER_NAMES = CATEGORIES.map((c) => c.name);

export function getCategoryByName(name: string): CategoryConfig | null {
  return CATEGORIES.find((c) => c.name === name) ?? null;
}

export function getCategoryBySlug(slug: CategorySlug): CategoryConfig | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/**
 * memory_inputs에 저장된 사용자의 이야기 평문을 읽어옵니다.
 * 새 데이터는 평문 문자열, 과거 데이터는 { story: "..." } 형태일 수 있어 둘 다 지원합니다.
 */
export function getStory(saved: unknown): string {
  if (typeof saved === "string") return saved.trim();
  if (saved && typeof saved === "object" && LEGACY_STORY_KEY in saved) {
    const value = (saved as Record<string, unknown>)[LEGACY_STORY_KEY];
    return typeof value === "string" ? value.trim() : "";
  }
  return "";
}

export function hasStory(saved: unknown): boolean {
  return getStory(saved).length > 0;
}

/** 프롬프트에 넣을 이야기 재료 블록 */
export function formatStoryForPrompt(story: string): string {
  const trimmed = story.trim();
  return trimmed.length > 0 ? trimmed : "(아직 없음)";
}
