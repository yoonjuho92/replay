-- ----------------------------------------------------------------------------
-- One-time setup for the new writing + illustration flow.
-- Run in the Supabase SQL editor (or via `supabase db ...`).
-- ----------------------------------------------------------------------------

-- 1. Folder columns for the multi-illustration flow.
--    Each folder now has 1~5 illustrations planned by an LLM.
--    - image_draft: snapshot of the draft text used to plan the illustrations
--      (so we can skip re-planning when the draft has not changed)
--    - image_target_count: how many illustrations the latest plan called for
--    - image_scenes: jsonb array of { caption, prompt } for each illustration
--    The actual image files live in Storage at "<userId>/<folderId>-<i>.png".
alter table public.folders drop column if exists image_path;
alter table public.folders
  add column if not exists image_draft text,
  add column if not exists image_target_count int,
  add column if not exists image_scenes jsonb;

-- 2. Create a public storage bucket for illustrations (idempotent).
insert into storage.buckets (id, name, public)
values ('illustrations', 'illustrations', true)
on conflict (id) do update set public = true;

-- 3. Storage RLS: let each authenticated user upload, read, update, and delete
--    objects under their own user-id prefix in the `illustrations` bucket.
--    (Scene images live at "<user_id>/<folder_id>-<sceneIndex>.png".
--     The user's reference selfie lives at "<user_id>/profile.<ext>".)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'illustrations: owner write'
  ) then
    create policy "illustrations: owner write"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'illustrations'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'illustrations: owner update'
  ) then
    create policy "illustrations: owner update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'illustrations'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'illustrations: owner delete'
  ) then
    create policy "illustrations: owner delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'illustrations'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Public read is granted automatically by the bucket being public,
  -- but adding an explicit SELECT policy is fine for clarity.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'illustrations: public read'
  ) then
    create policy "illustrations: public read"
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'illustrations');
  end if;
end $$;

-- 4. Cleanup of any earlier-version trigger that tried to DELETE rows from
--    storage.objects directly — Supabase forbids that. We now do storage
--    cleanup from the application via the Storage API instead.
drop trigger if exists folders_cleanup_illustration_del on public.folders;
drop trigger if exists folders_cleanup_illustration_upd on public.folders;
drop function if exists public.folders_cleanup_illustration();
