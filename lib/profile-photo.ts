import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_BUCKET = "illustrations";
export const PROFILE_BASENAME = "profile";
export const PROFILE_MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export function extensionForMime(mime: string): string | null {
  return ALLOWED_MIME[mime.toLowerCase()] ?? null;
}

export function profileObjectPath(userId: string, ext: string): string {
  return `${userId}/${PROFILE_BASENAME}.${ext}`;
}

export async function findProfilePhoto(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ path: string; publicUrl: string } | null> {
  const { data } = await supabase.storage.from(PROFILE_BUCKET).list(userId, {
    limit: 20,
  });
  const file = (data ?? []).find((o) =>
    Object.values(ALLOWED_MIME).some(
      (ext) => o.name === `${PROFILE_BASENAME}.${ext}`,
    ),
  );
  if (!file) return null;
  const path = `${userId}/${file.name}`;
  const { data: pub } = supabase.storage
    .from(PROFILE_BUCKET)
    .getPublicUrl(path);
  return { path, publicUrl: pub?.publicUrl ?? "" };
}

export async function removeOtherProfilePhotos(
  supabase: SupabaseClient,
  userId: string,
  keepExt: string,
): Promise<void> {
  const { data } = await supabase.storage.from(PROFILE_BUCKET).list(userId, {
    limit: 20,
  });
  const toRemove = (data ?? [])
    .filter((o) =>
      Object.values(ALLOWED_MIME).some(
        (ext) =>
          o.name === `${PROFILE_BASENAME}.${ext}` && ext !== keepExt,
      ),
    )
    .map((o) => `${userId}/${o.name}`);
  if (toRemove.length) {
    await supabase.storage.from(PROFILE_BUCKET).remove(toRemove);
  }
}

export type UploadProfilePhotoResult = {
  error: string | null;
  publicUrl?: string;
};

export async function uploadProfilePhoto(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<UploadProfilePhotoResult> {
  if (file.size === 0) {
    return { error: "사진 파일이 비어 있어요." };
  }
  if (file.size > PROFILE_MAX_BYTES) {
    return { error: "8MB 이하 이미지로 올려 주세요." };
  }
  const ext = extensionForMime(file.type);
  if (!ext) {
    return { error: "지원하지 않는 이미지 형식이에요 (png/jpg/webp)." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = profileObjectPath(userId, ext);
  const upload = await supabase.storage.from(PROFILE_BUCKET).upload(
    path,
    buffer,
    {
      contentType: file.type,
      upsert: true,
    },
  );
  if (upload.error) {
    const msg = upload.error.message;
    if (msg.toLowerCase().includes("bucket not found")) {
      return {
        error:
          "Supabase Storage에 'illustrations' 버킷이 없어요. supabase-setup.sql 을 실행해 주세요.",
      };
    }
    return { error: `사진 업로드 실패: ${msg}` };
  }
  await removeOtherProfilePhotos(supabase, userId, ext);
  const { data: pub } = supabase.storage
    .from(PROFILE_BUCKET)
    .getPublicUrl(path);
  return { error: null, publicUrl: pub?.publicUrl ?? undefined };
}
