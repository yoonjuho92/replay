import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  type CategoryConfig,
  getCategoryByName,
  getStory,
} from "../categories";

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function persistStory(
  folderId: string,
  summary: string,
): Promise<string> {
  const next = summary.trim();
  if (next.length === 0) return "";
  const supabase = await createClient();
  await supabase
    .from("folders")
    .update({
      memory_inputs: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", folderId);
  return next;
}

export async function loadFolderState(folderId: string): Promise<{
  name: string;
  category: CategoryConfig;
  story: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("name, memory_inputs")
    .eq("id", folderId)
    .maybeSingle();
  if (!data) return null;
  const category = getCategoryByName(data.name);
  if (!category) return null;
  const story = getStory(data.memory_inputs);
  return { name: data.name, category, story };
}
