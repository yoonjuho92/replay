export type CategorySlug =
  | "regret"
  | "achievement"
  | "love"
  | "relationships"
  | "friends";

export type Question = {
  field: string;
  shortLabel: string;
  question: string;
  example?: string;
  groupTitle?: string;
};

export type CategoryConfig = {
  slug: CategorySlug;
  name: string;
  available: boolean;
  questions: Question[];
  agentPersona: string;
  writingCoachPersona: string;
};

const REGRET_QUESTIONS: Question[] = [
  { field: "regret", shortLabel: "가장 후회하는 선택", question: "내가 가장 후회하는 선택은 무엇인가요?" },
  { field: "regret_reason", shortLabel: "후회의 이유", question: "그 선택을 후회하는 이유는 무엇인가요?" },
  { field: "current_impact", shortLabel: "현재의 영향", question: "그 선택의 결과가 현재의 삶에 어떤 영향을 미쳤나요?" },
  { field: "place", shortLabel: "그날의 장소", question: "나는 어디에 있나요?" },
  { field: "companion", shortLabel: "함께 있던 사람", question: "나는 누구와 함께 있나요?" },
  { field: "activity", shortLabel: "그때 하던 일", question: "나는 무엇을 하고 있나요?" },
  { field: "weather", shortLabel: "그날의 날씨", question: "그날의 날씨는 어땠나요?" },
  { field: "sounds", shortLabel: "주변의 소리", question: "주변에서는 어떤 소리가 들렸나요?" },
  { field: "clothes", shortLabel: "그날의 옷차림", question: "나는 어떤 옷을 입고 있었나요?" },
  { field: "inner_warning", shortLabel: "마음속 경고음", question: "혹시 마음속에 들려오는 작은 경고음을 무시하진 않았나요?" },
  { field: "companion_reaction", shortLabel: "동행자의 반응", question: "나와 함께 있었던 사람의 반응은 어땠나요?" },
  { field: "unsaid_words", shortLabel: "미처 하지 못한 말", question: "미처 하지 못한 말이 있나요?" },
];

const ACHIEVEMENT_QUESTIONS: Question[] = [
  {
    field: "value_weight",
    shortLabel: "성취의 무게",
    question: "내 삶에서 무언가를 이루어내는 '성취'는 얼마나 중요한 가치인가요?",
  },
  {
    field: "best_effort",
    shortLabel: "최선의 기억",
    question: "살면서 가장 최선을 다해 본 순간은 언제인가요?",
    example:
      "입시, 학업, 사랑을 찾는 것, 육아, 원하는 직업 갖기, 마음의 평온 찾기, 자전거 타기 등 아주 사소한 것도 좋습니다.",
  },
  {
    field: "when",
    shortLabel: "그때의 시기",
    question: "그때가 구체적으로 언제였나요?",
    groupTitle: "노력의 기록",
  },
  {
    field: "duration",
    shortLabel: "노력의 지속 기간",
    question: "그 노력은 얼마나 오랫동안 지속되었나요?",
    groupTitle: "노력의 기록",
  },
  {
    field: "result",
    shortLabel: "노력의 결과",
    question: "노력의 결과는 무엇이었으며, 본인이 원했던 만큼의 결과였나요?",
    groupTitle: "노력의 기록",
  },
  {
    field: "sacrifice",
    shortLabel: "희생과 대가",
    question: "그 노력을 위해 포기해야 했던 것은 무엇인가요?",
  },
  {
    field: "emotion",
    shortLabel: "감정의 잔상",
    question: "결과에 대해 아쉬움이 남는 부분과 가장 자랑스러웠던 순간은 각각 언제인가요?",
  },
  {
    field: "letter_to_self",
    shortLabel: "나에게 건네는 말",
    question: "그때 치열하게 노력했던 과거의 나에게 한마디 해준다면?",
  },
  {
    field: "impact",
    shortLabel: "영향력",
    question: "그때의 노력이 지금의 내 삶에 어떤 영향을 미치고 있나요?",
  },
];

const REGRET_CONFIG: CategoryConfig = {
  slug: "regret",
  name: "후회",
  available: true,
  questions: REGRET_QUESTIONS,
  agentPersona:
    "당신은 사용자의 후회되는 과거 기억을 따뜻하고 진솔한 대화로 풀어내는 동행자입니다.",
  writingCoachPersona:
    "당신은 사용자가 자신의 후회되는 기억을 한 편의 짧은 에세이로 정리하도록 돕는 글쓰기 코치입니다.",
};

const ACHIEVEMENT_CONFIG: CategoryConfig = {
  slug: "achievement",
  name: "성취",
  available: true,
  questions: ACHIEVEMENT_QUESTIONS,
  agentPersona:
    "당신은 사용자가 살면서 가장 최선을 다해 본 순간(성취의 기억)을 따뜻하고 진솔한 대화로 풀어내는 동행자입니다.",
  writingCoachPersona:
    "당신은 사용자가 자신의 성취 기억을 한 편의 짧은 에세이로 정리하도록 돕는 글쓰기 코치입니다.",
};

function makeComingSoonConfig(slug: CategorySlug, name: string): CategoryConfig {
  return {
    slug,
    name,
    available: false,
    questions: [],
    agentPersona: "",
    writingCoachPersona: "",
  };
}

export const CATEGORIES: CategoryConfig[] = [
  REGRET_CONFIG,
  ACHIEVEMENT_CONFIG,
  makeComingSoonConfig("love", "사랑"),
  makeComingSoonConfig("relationships", "미움과 관계"),
  makeComingSoonConfig("friends", "친구"),
];

export const SYSTEM_FOLDER_NAMES = CATEGORIES.map((c) => c.name);

export function getCategoryByName(name: string): CategoryConfig | null {
  return CATEGORIES.find((c) => c.name === name) ?? null;
}

export function getCategoryBySlug(slug: CategorySlug): CategoryConfig | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

export function createEmptyAnswers(category: CategoryConfig): Record<string, string> {
  return category.questions.reduce(
    (acc, q) => ({ ...acc, [q.field]: "" }),
    {} as Record<string, string>,
  );
}

export function normalizeAnswers(
  category: CategoryConfig,
  saved: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out = createEmptyAnswers(category);
  if (!saved) return out;
  for (const q of category.questions) {
    const v = saved[q.field];
    if (typeof v === "string") out[q.field] = v;
  }
  return out;
}

export function isAllFilled(
  category: CategoryConfig,
  answers: Record<string, string>,
): boolean {
  return category.questions.every(
    (q) => (answers[q.field] ?? "").trim().length > 0,
  );
}

export function filledFields(
  category: CategoryConfig,
  answers: Record<string, string>,
): Question[] {
  return category.questions.filter(
    (q) => (answers[q.field] ?? "").trim().length > 0,
  );
}

export function remainingFields(
  category: CategoryConfig,
  answers: Record<string, string>,
): Question[] {
  return category.questions.filter(
    (q) => (answers[q.field] ?? "").trim().length === 0,
  );
}

export function formatAnswersForPrompt(
  category: CategoryConfig,
  answers: Record<string, string>,
): string {
  return category.questions
    .map((q) => `- ${q.shortLabel} [${q.field}]: ${answers[q.field] || "(없음)"}`)
    .join("\n");
}
