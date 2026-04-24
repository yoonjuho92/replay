export const INPUT_FIELDS = [
  "regret",
  "regret_reason",
  "current_impact",
  "place",
  "companion",
  "activity",
  "weather",
  "sounds",
  "clothes",
  "inner_warning",
  "companion_reaction",
  "unsaid_words",
] as const;

export type InputField = (typeof INPUT_FIELDS)[number];

export type MemoryInput = Record<InputField, string>;

export const INPUT_LABELS: Record<InputField, string> = {
  regret: "내가 가장 후회하는 선택",
  regret_reason: "그 선택을 후회하는 이유",
  current_impact: "그 선택의 결과가 현재의 삶에 미친 영향",
  place: "그날 내가 있었던 곳",
  companion: "그날 함께 있던 사람",
  activity: "그때 내가 하고 있던 일",
  weather: "그날의 날씨",
  sounds: "주변에서 들리던 소리",
  clothes: "그날 입고 있던 옷",
  inner_warning: "마음속의 작은 경고음",
  companion_reaction: "함께 있던 사람의 반응",
  unsaid_words: "미처 하지 못한 말",
};

export const EMPTY_INPUT: MemoryInput = INPUT_FIELDS.reduce(
  (acc, key) => ({ ...acc, [key]: "" }),
  {} as MemoryInput,
);

export type MemorySave = MemoryInput & { generated: string };

export type MemoryChoices = {
  items: { text: string; narrative: string }[];
  selected: number | null;
};

export function formatInputForPrompt(input: MemoryInput): string {
  return INPUT_FIELDS.map(
    (key) => `${INPUT_LABELS[key]}: ${input[key] || "(없음)"}`,
  ).join("\n");
}
