-- ============================================================================
-- Durable hardening: make family_code a non-spoofable JWT claim via app_metadata.
--
-- Background: family_code historically lived only in user_metadata, which end
-- users can edit (supabase.auth.updateUser({ data })). 20260615000004 moved the
-- security boundary off user_metadata: RLS now derives family_code from the
-- people row (public.auth_family_code()), and the app reads it from the people
-- row (lib/auth/family.ts). The one path that cannot use the people row is the
-- bootstrap that CREATES a user's first people row — it has no row to read yet.
--
-- This migration closes that last gap by putting family_code in app_metadata
-- (NOT user-editable, and present in the JWT). Registration now stamps it (see
-- app/actions/register.ts); this backfills it for existing users from their
-- authoritative people row, and tightens the people-insert bootstrap branch to
-- require the inserted family_code to match the app_metadata claim.
--
-- Note: referencing app_metadata in RLS is safe and is the Supabase-recommended
-- pattern — the "user_metadata in RLS" advisor only flags user_metadata.
-- ============================================================================

-- ── Backfill app_metadata.family_code from the authoritative people row ───────
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('family_code', p.family_code)
FROM public.people p
WHERE p.user_id = u.id
  AND p.family_code IS NOT NULL
  AND p.family_code <> ''
  AND COALESCE(u.raw_app_meta_data ->> 'family_code', '') IS DISTINCT FROM p.family_code;

-- ── Tighten the people-insert bootstrap branch ────────────────────────────────
-- The self-bootstrap branch (a user with no people row yet) previously accepted
-- ANY family_code. Now it must match the app_metadata claim, which the user
-- cannot forge — so a user can only bootstrap into the family they actually
-- belong to. The normal "add someone to my family" branch is unchanged (still
-- derived from the people row via auth_family_code()).
DROP POLICY IF EXISTS "family can insert people" ON people;
CREATE POLICY "family can insert people"
  ON people FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = auth.uid() OR user_id = auth.uid())
    AND (
      family_code = public.auth_family_code()
      OR (
        user_id = auth.uid()
        AND public.auth_family_code() IS NULL
        AND family_code = (auth.jwt() -> 'app_metadata' ->> 'family_code')
      )
    )
  );
