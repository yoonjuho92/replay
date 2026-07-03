"use server";

import OpenAI, { toFile } from "openai";
import { TRANSCRIBE_MODEL } from "../folders/prompts/models";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export type TranscribeResult = {
  text: string | null;
  error: string | null;
};

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function transcribeAudio(
  formData: FormData,
): Promise<TranscribeResult> {
  const openai = getOpenAI();
  if (!openai) {
    return { text: null, error: "OPENAI_API_KEY가 설정되지 않았어요." };
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return { text: null, error: "오디오 파일이 비어 있어요." };
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return { text: null, error: "오디오 길이가 너무 길어요." };
  }

  const mime = audio.type || "audio/webm";
  const ext = mime.includes("ogg")
    ? "ogg"
    : mime.includes("mp4")
      ? "mp4"
      : mime.includes("wav")
        ? "wav"
        : "webm";
  const buffer = Buffer.from(await audio.arrayBuffer());
  const file = await toFile(buffer, `audio.${ext}`, { type: mime });

  try {
    const result = await openai.audio.transcriptions.create({
      file,
      model: TRANSCRIBE_MODEL,
      language: "ko",
      response_format: "json",
    });
    return { text: (result.text ?? "").trim(), error: null };
  } catch (e) {
    return {
      text: null,
      error:
        e instanceof Error
          ? `음성 인식 실패: ${e.message}`
          : "음성 인식에 실패했어요.",
    };
  }
}
