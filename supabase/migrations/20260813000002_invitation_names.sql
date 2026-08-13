-- ============================================================================
-- An invitation carries the invitee's name. COLUMNS ONLY — the functions move in
-- 20260813000004.
--
-- WHY
--   An invitation used to be an email address and nothing else, which cost something at
--   both ends of the flow:
--
--     * **The approvals queue was a list of addresses.** "Invited: j.okon94@gmail.com"
--       tells an administrator reviewing outstanding invitations nothing about who that
--       is, which is the question that screen exists to answer. Family email addresses
--       are frequently opaque, and the person working the queue is often not the person
--       who sent the invitation a week earlier.
--     * **The `people` row was born blank.** `redeem_family_invitation` seeds the new row
--       from `raw_user_meta_data`, so a member who registered THROUGH the invitation link
--       arrived named — and one who already had an account and merely signed in to accept
--       arrived as two empty strings. That row is what the directory, the tree and every
--       RSVP list render.
--
-- ── WHY THIS FILE TOUCHES NO FUNCTIONS, AND THAT IS THE POINT ───────────────
--   The first draft of this migration DROPped and recreated
--   `create_family_invitation`, `peek_family_invitation` and `redeem_family_invitation`
--   to take the new columns — and it derived all three bodies from 20260806000013 /
--   20260806000014 / 20260810000000, which were the versions in front of whoever wrote
--   it. They are not the current versions. **20260811000001 had rewritten all three**,
--   and recreating them from the older copies silently reverted every one of its
--   changes: a declined applicant read as "already in this family" again and could never
--   be asked back, a re-invitation stored `pre_approved = true` and promised access it
--   would not confer, and redemption lost the `AND NOT v_reopen` clamp that stops an
--   invitation reversing a refusal without a fresh human decision.
--
--   Nothing failed. The migration applied, the functions existed, and the app worked —
--   for everybody except a declined applicant, which is a state no smoke test visits.
--   `tests/rls` caught it, on the case 20260811000001 wrote for exactly this
--   ("a declined applicant can be asked back"), through its POSITIVE CONTROL rather than
--   its attack. That is the rule AGENTS.md §7 states, demonstrated: the attack half
--   passed the whole time.
--
--   So the functions are defined ONCE, in 20260813000004, derived from the current
--   bodies. One restatement instead of two halves the chance of it happening again, and
--   this file is left doing the one thing that cannot go stale.
--
-- **The general rule this earns:** before `CREATE OR REPLACE`-ing any function in this
-- schema, `grep -l "FUNCTION public.<name>" supabase/migrations/` and start from the
-- LAST file that defines it, not the one you happen to be reading. plpgsql replaces the
-- whole body, so a partial copy is a silent revert.
--
-- REQUIRED, NOT OPTIONAL — enforced in the function, where every caller meets it, rather
-- than in the dialog, because a `'use server'` export is a public HTTP endpoint and the
-- form is not in its request path. Existing rows keep `''`; nothing back-fills them,
-- because there is nobody to ask.
--
-- THE NAME IS NOT AN IDENTITY CLAIM. The token is still the credential and the address is
-- still the narrowing condition on it (20260806000013 §4). The name is a LABEL: it is what
-- the queue shows and what seeds the person row, and redemption still prefers the
-- account's own metadata where there is any, because the person who owns the account is a
-- better authority on their own name than whoever invited them.
--
-- IDEMPOTENT.
--
-- HOW THIS REACHES A DATABASE
--   `supabase db push`, from CI on merge to master — never `psql -f` by hand. See
--   AGENTS.md, "How migrations reach the hosted project".
-- ============================================================================

BEGIN;

-- NOT NULL DEFAULT '' rather than nullable: `people.first_name` and `last_name` are
-- themselves `NOT NULL DEFAULT ''` (20260602000003), so an empty string is already this
-- schema's word for "not recorded", and a second spelling of it would mean every reader
-- handles both.
ALTER TABLE public.family_invitations
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name  TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.family_invitations.first_name IS
  'What the INVITER called the invitee. A label for the approvals queue and a fallback '
  'seed for the people row — never an identity claim. Required on new invitations; '
  'rows created before 20260813000002 carry ''''.';

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='family_invitations' AND column_name='first_name'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='family_invitations' AND column_name='last_name'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: family_invitations is missing first_name / last_name';
  END IF;
END $mig$;

COMMIT;
