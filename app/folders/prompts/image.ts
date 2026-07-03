import type { ImageStyle } from "../categories";

export type Scene = { caption: string; prompt: string };

/** 스타일별로 그림 프롬프트 맨 앞에 붙는 화풍 지시문 */
export function styleDirective(style: ImageStyle): string[] {
  if (style === "comic") {
    return [
      "A single warm, gentle hand-drawn cartoon illustration with clean confident outlines, soft flat color fills, and simple expressive faces, like a heartwarming storybook or webtoon panel. Full color.",
      "No text, no captions, no speech bubbles, no signatures. Square 1:1.",
    ];
  }
  if (style === "realistic") {
    return [
      "A single photorealistic illustration with natural soft lighting, realistic textures, gentle depth of field, and lifelike detail, like a candid film photograph of the remembered moment. Full color.",
      "No text, no captions, no watermarks, no signatures. Square 1:1.",
    ];
  }
  // line — 기존 펜화 선묘 스타일
  return [
    "A single hand-drawn line drawing in a delicate pen-and-ink style with visible pressure variation in the line work, like a fine writer's notebook sketch.",
    "Monochrome ink (warm dark brown ink on warm off-white paper). No text, no captions, no signatures.",
    "Composition: minimalist, intimate, slightly cinematic, with breathing white space and soft cross-hatching for tone. Square 1:1.",
  ];
}

/** 한 장면을 그리기 위한 최종 이미지 생성 프롬프트 */
export function buildImagePrompt(
  scene: Scene,
  draftExcerpt: string,
  hasReferencePhoto: boolean,
  style: ImageStyle,
): string {
  const lines = styleDirective(style);
  if (hasReferencePhoto) {
    lines.push(
      "",
      "Face reference: the attached photo is the user's selfie. The figure depicted in this illustration is the same person. Preserve their facial identity (face shape, eye shape, nose, mouth, hairline), translated faithfully into the style described above.",
      "Age: render the person at the age implied by the scene and the memory excerpt below, which may be much younger (child, teenager, young adult) or older than the reference photo. Adjust hair length/style, skin smoothness, posture, and clothing accordingly to fit the era, while keeping the underlying bone structure and identifying features recognizable.",
    );
  }
  lines.push(
    "",
    "Scene:",
    scene.prompt,
    "",
    "Source memory excerpt (tone reference only — depict the scene above, do not invent details beyond it):",
    draftExcerpt.slice(0, 500),
  );
  return lines.join("\n");
}

/** 사용자의 회고문에서 장면 3개를 뽑아내는 '일러스트 디렉터' 시스템 프롬프트 */
export const SCENE_PLAN_SYSTEM_PROMPT = [
  "당신은 사용자의 짧은 회고문을 읽고 그 글의 핵심 장면을 정확히 3개 추려내는 일러스트 디렉터입니다.",
  "",
  "[규칙]",
  "- 반드시 장면을 3개 만드세요. 글이 짧더라도 한 이야기 안의 서로 다른 순간 3개로 나눠 보세요(예: 시작 장면, 가장 마음이 머무는 순간, 여운이 남는 장면).",
  "- 같은 장면을 약간 다른 각도로 두 번 그리지 마세요. 셋 다 분명히 다른 순간이어야 합니다.",
  "- 각 장면은 글의 흐름 순서대로 배열하세요.",
  "- 각 장면에 두 가지 필드:",
  "  - caption: 한국어, 6~16자. 그 장면을 가리키는 짧은 라벨.",
  "  - prompt: 영어, 40~80 단어. 그 장면을 그리기 위한 시각적 묘사. 인물의 표정/자세, 장소, 시간대, 빛, 공기감을 구체적으로. 화풍(스타일)은 적지 말고 장면 내용만 묘사하세요. 큰따옴표나 별표 사용 금지.",
  "- 글에 명시되지 않은 사실은 만들지 않습니다.",
  '- 결과는 JSON으로만: {"scenes":[{"caption":"...","prompt":"..."},{...},{...}]}',
  "- 코드 블록, 추가 설명, 머리말 금지.",
].join("\n");

/** 장면 분석 LLM 호출에 넣을 사용자 프롬프트 */
export function buildScenePlanUserPrompt(args: {
  categoryName: string;
  folderName: string;
  answersBlock: string;
  draft: string;
}): string {
  return [
    `카테고리: ${args.categoryName}`,
    `폴더 이름: ${args.folderName}`,
    "",
    "사용자의 답변:",
    args.answersBlock,
    "",
    "사용자의 글:",
    args.draft,
  ].join("\n");
}
