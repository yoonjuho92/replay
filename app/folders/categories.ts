export type CategorySlug =
  | "food"
  | "adventure"
  | "friend"
  | "season"
  | "seoul"
  | "song";

export type CategoryConfig = {
  slug: CategorySlug;
  name: string;
  available: boolean;
  /** 이 자서전 챕터가 어떤 이야기를 담는지 한 줄 설명 */
  theme: string;
  /** 대화를 여는 첫 질문 */
  opening: string;
};

// 주제별 페르소나·인터뷰 안내 등 LLM에 들어가는 프롬프트 조각은
// `./prompts/category-prompts` 에 slug 기준으로 모아 두었다.

/** 그림을 그릴 때 고를 수 있는 스타일 */
export type ImageStyle = "comic" | "realistic" | "line";

export type ImageStyleConfig = {
  id: ImageStyle;
  label: string;
  /** 선택 화면에 보여줄 짧은 설명 */
  hint: string;
};

export const IMAGE_STYLES: ImageStyleConfig[] = [
  { id: "comic", label: "만화풍", hint: "따뜻한 손그림 만화" },
  { id: "realistic", label: "실사풍", hint: "사진 같은 사실적인 그림" },
  { id: "line", label: "선묘화", hint: "펜으로 그린 선 그림" },
];

export const DEFAULT_IMAGE_STYLE: ImageStyle = "comic";

export function isImageStyle(value: unknown): value is ImageStyle {
  return value === "comic" || value === "realistic" || value === "line";
}

export function getImageStyle(value: unknown): ImageStyle {
  return isImageStyle(value) ? value : DEFAULT_IMAGE_STYLE;
}

/** 예전 데이터 호환용: 과거에는 { story: "..." } 형태로 저장했다. */
const LEGACY_STORY_KEY = "story";

const FOOD_CONFIG: CategoryConfig = {
  slug: "food",
  name: "음식",
  available: true,
  theme: "내 인생에서 가장 기억에 남는 한 가지 음식에 대한 이야기",
  opening:
    "살아오면서 가장 기억에 남는 음식을 하나 떠올려 볼까요? 좋아했던 음식, 이제는 먹을 수 없는 음식, 끝내 먹어보지 못한 음식, 사랑하는 사람이 좋아했던 음식… 무엇이든 좋아요. 어떤 음식이 떠오르세요?",
};

const ADVENTURE_CONFIG: CategoryConfig = {
  slug: "adventure",
  name: "모험",
  available: true,
  theme: "내 인생에서 가장 큰 도전이나 모험에 대한 이야기",
  opening:
    "내 인생에서 가장 큰 도전은 무엇이었나요? 결혼을 결심한 일, 이사, 누군가를 사랑하기로 한 일, 아이를 키운 일, 새 공부를 시작한 일, 어딘가로 떠난 일, 혼자 있기로 한 결심… 무엇이든 좋아요. 어떤 모험이 떠오르세요?",
};

const FRIEND_CONFIG: CategoryConfig = {
  slug: "friend",
  name: "친구",
  available: true,
  theme: "살아오면서 가장 먼저 떠오르는 한 친구에 대한 이야기",
  opening:
    "살아오면서 가장 먼저 떠오르는 친구를 한 사람 떠올려 볼까요? 지금도 만나는 친구, 오래전 연락이 끊긴 친구, 더는 만날 수 없는 친구, 짧지만 강렬했던 인연… 누구든 좋아요. 어떤 친구가 떠오르세요?",
};

const SEASON_CONFIG: CategoryConfig = {
  slug: "season",
  name: "계절",
  available: true,
  theme: "네 계절 중 가장 마음이 가는 한 계절에 대한 이야기",
  opening:
    "네 계절 중에서 가장 마음이 가는 계절을 하나 떠올려 볼까요? 가장 좋아하는 계절, 가장 싫어하는 계절, 유독 그리운 계절, 어떤 시기를 떠올리면 따라오는 계절… 무엇이든 좋아요. 어느 계절이 떠오르세요?",
};

const SEOUL_CONFIG: CategoryConfig = {
  slug: "seoul",
  name: "서울",
  available: true,
  theme: "나에게 서울이라는 도시가 어떤 곳이었는지에 대한 이야기",
  opening:
    "서울 이야기를 함께 나눠 볼까요? 먼저, 서울에서 태어나셨나요, 아니면 다른 곳에서 서울로 오셨나요?",
};

const SONG_CONFIG: CategoryConfig = {
  slug: "song",
  name: "노래",
  available: true,
  theme: "내 인생에서 가장 기억에 남는 한 곡의 노래에 대한 이야기",
  opening:
    "살아오면서 가장 기억에 남는 노래를 하나 떠올려 볼까요? 좋아했던 노래, 누군가 즐겨 부르던 노래, 어떤 시절을 떠올리게 하는 노래, 지금도 흥얼거리게 되는 노래… 무엇이든 좋아요. 어떤 노래가 떠오르세요?",
};

export const CATEGORIES: CategoryConfig[] = [
  FOOD_CONFIG,
  ADVENTURE_CONFIG,
  FRIEND_CONFIG,
  SEASON_CONFIG,
  SEOUL_CONFIG,
  SONG_CONFIG,
];

export const SYSTEM_FOLDER_NAMES = CATEGORIES.map((c) => c.name);

/** 로그인 후 한 번 고르는 주제 쌍 — 각 쌍을 고르면 두 주제의 폴더가 생긴다. */
export type TopicPair = {
  id: string;
  label: string;
  slugs: [CategorySlug, CategorySlug];
};

export const TOPIC_PAIRS: TopicPair[] = [
  { id: "food-adventure", label: "음식 + 모험", slugs: ["food", "adventure"] },
  { id: "friend-season", label: "친구 + 계절", slugs: ["friend", "season"] },
  { id: "seoul-song", label: "서울 + 노래", slugs: ["seoul", "song"] },
];

export function getPairById(id: string): TopicPair | null {
  return TOPIC_PAIRS.find((p) => p.id === id) ?? null;
}

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
