-- ═══════════════════════════════════════════════════════════════════════════════════
-- BIRTHDAYS: a record that a greeting happened, and the prompt that asks for one
-- ═══════════════════════════════════════════════════════════════════════════════════
--
-- `/community/announcements?pane=birthdays` has listed the next sixty days' birthdays since it
-- was written, and nothing else. TODO.md's entry names the three decisions and they are made:
--
--   WHO GREETS      The FAMILY. A member composes, two weeks ahead, and every word that
--                   reaches the birthday person was typed by a person. The product's own
--                   greeting appears on THEIR OWN DASHBOARD and is posted nowhere — see
--                   "WHAT THE PRODUCT WRITES" below, which is the load-bearing decision.
--   WHERE IT LANDS  A pinned announcement, family-wide, when a person wrote one. The
--                   birthday member's own dashboard, always.
--   CELEBRATION     A gold band and confetti, `--brand-legacy` territory, degrading to
--                   something dignified for a relative with no photograph.
--
-- ── WHAT THIS TABLE IS FOR, AND IT IS NOT THE GREETING ─────────────────────────────
-- TODO.md: *"What does not exist is any record that a greeting HAPPENED, so 'did anyone say
-- anything to Ada?' is unanswerable — and without it a prompt reappears every year whether or
-- not the family acted on it last time."* That is the whole of this table. One row per
-- (person, year), written when somebody composes or when somebody dismisses the prompt.
--
-- IT DOES NOT HOLD THE MESSAGE. The message is an `announcements` row like any other, written
-- by a member, editable and deletable by whoever may edit announcements — so a family that
-- wants to change what it said changes it in the one place announcements live. This row holds
-- the `announcement_id` as a REFERENCE and goes NULL if that announcement is deleted, which is
-- the `gathering_tasks.step_id` shape: provenance, not content.
--
-- ── AND IT IS PER YEAR, NOT PER BIRTHDAY ───────────────────────────────────────────
-- `greeting_year` is an integer, not a date. A birthday recurs; the greeting does not. Keying
-- on the DATE would make a leap-day relative ungreetable in three years out of four, and a
-- person whose recorded birthday is corrected would silently acquire a second unanswered
-- prompt for the same year.
--
-- ── NO SCHEDULER, WHICH SHAPES EVERYTHING ──────────────────────────────────────────
-- `pg_cron` is installed and nothing in the product runs on a clock except the Stripe sweep.
-- Both surfaces here are rendered when somebody OPENS the app, so neither needs one: the
-- dashboard band is computed from `people.date_of_birth` at render time, and the two-week
-- prompt is a read over the same horizon `lib/birthdays.ts` already walks. Nothing is sent.

CREATE TABLE IF NOT EXISTS public.birthday_greetings (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  family_code     TEXT NOT NULL REFERENCES public.families(family_code) ON DELETE CASCADE,
  -- WHOSE birthday. CASCADE: a greeting for a person who is no longer in the family is not a
  -- record worth keeping, and the announcement it points at survives on its own.
  person_id       UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- The calendar year the greeting is FOR. See the header on why this is not a date.
  greeting_year   INT  NOT NULL,
  /*
   * What happened. Three values, and the third is the one that makes the prompt bearable.
   *
   *   composed    somebody wrote and posted a greeting. `announcement_id` points at it.
   *   dismissed   somebody said "not this year" — a family that greets in person, a relative
   *               who has asked not to be named, a recorded ancestor who died and whose
   *               birthday nobody wants a prompt about. Without it the prompt is a nag.
   *   silent      the day passed with neither. Written by nothing today and reserved rather
   *               than invented later: a status column that grows a value is a column three
   *               resolvers have to be taught about, and this one is CHECKed.
   */
  status          TEXT NOT NULL DEFAULT 'composed'
                    CHECK (status IN ('composed', 'dismissed', 'silent')),
  -- PROVENANCE, NOT CONTENT (see the header). SET NULL, so deleting the announcement leaves
  -- the record that a greeting was written rather than deleting the fact with the words.
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE SET NULL,
  -- Who acted. SET NULL for `people.id`'s usual reason: losing the actor must not delete the
  -- record of the act.
  acted_by        UUID REFERENCES public.people(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── ONE ROW PER PERSON PER YEAR, AND THE DATABASE SAYS SO ─────────────────────────
  -- Not a nicety: `hasGreetingThisYear` is the whole prompt condition, and two rows would
  -- make the answer depend on which one PostgREST listed first — a prompt that appeared and
  -- disappeared between two loads of the same screen.
  CONSTRAINT birthday_greetings_one_per_year UNIQUE (person_id, greeting_year)
);

COMMENT ON TABLE public.birthday_greetings IS
  'One row per person per YEAR recording that their family greeted them, dismissed the '
  'prompt, or let it pass. It does NOT hold the message — that is an announcements row, '
  'referenced here and SET NULL if deleted (provenance, not content). Keyed on the year and '
  'not the date, so a leap-day relative is greetable every year. Added 20260831000002.';

COMMENT ON COLUMN public.birthday_greetings.status IS
  'composed | dismissed | silent. `dismissed` is what stops the prompt being a nag for a '
  'family that greets in person or a relative who has asked not to be named. `silent` is '
  'reserved and written by nothing today.';

CREATE INDEX IF NOT EXISTS birthday_greetings_family_year_idx
  ON public.birthday_greetings (family_code, greeting_year);

-- ── RLS ────────────────────────────────────────────────────────────────────────────
-- §2c: a new table in `public` is born readable AND writable by both browser roles, so RLS is
-- the entire boundary. One SELECT policy and no write policy at all — the arrangement the six
-- Gatherings tables and the five Meetings tables both use, and it denies INSERT, UPDATE and
-- DELETE to the browser outright.
ALTER TABLE public.birthday_greetings ENABLE ROW LEVEL SECURITY;

-- ── WHY EVERY APPROVED MEMBER MAY READ IT ──────────────────────────────────────────
-- The question this table answers — *did anybody say anything to Ada?* — is one every relative
-- can already answer by scrolling the announcements board, because a composed greeting IS a
-- pinned announcement. Narrowing this would withhold the fact that a public message exists,
-- which is not a fact worth withholding, and would make the DASHBOARD BAND unrenderable for
-- the one person it is for: the birthday member reads their own row.
--
-- Deliberately NOT keyed on `auth_permission`, and there is no `permission_table_map` row for
-- it — the same call `library/meeting-minutes` makes. A family that has switched
-- `community/announcements` off has switched off the SCREEN; whether a greeting happened is
-- not a screen.
CREATE POLICY "birthday_greetings_select" ON public.birthday_greetings
  FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND public.auth_membership_approved()
  );

-- ── THE GUARD TRIGGER, BECAUSE THE SERVICE ROLE IGNORES RLS AND NOT TRIGGERS ───────
-- §4: RLS checks the row, never the ids the row references. Every write here goes through the
-- admin client, so a `person_id` or an `announcement_id` from another family would be written
-- onto a row whose own `family_code` is correct and which therefore satisfies every policy.
-- The action checks with `belongsToFamily`; this is what holds if it ever stops.
CREATE OR REPLACE FUNCTION public.tg_birthday_greeting_guard_family()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_person text;
  v_ann    text;
BEGIN
  SELECT p.family_code INTO v_person FROM public.people p WHERE p.id = NEW.person_id;
  IF v_person IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION 'birthday_greetings.person_id belongs to family %, not %',
      COALESCE(v_person, '<none>'), NEW.family_code
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.announcement_id IS NOT NULL THEN
    SELECT a.family_code INTO v_ann
      FROM public.announcements a WHERE a.id = NEW.announcement_id;
    IF v_ann IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'birthday_greetings.announcement_id belongs to family %, not %',
        COALESCE(v_ann, '<none>'), NEW.family_code
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.acted_by IS NOT NULL THEN
    SELECT p.family_code INTO v_person FROM public.people p WHERE p.id = NEW.acted_by;
    IF v_person IS DISTINCT FROM NEW.family_code THEN
      RAISE EXCEPTION 'birthday_greetings.acted_by belongs to family %, not %',
        COALESCE(v_person, '<none>'), NEW.family_code
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS birthday_greetings_guard_family ON public.birthday_greetings;
CREATE TRIGGER birthday_greetings_guard_family
  BEFORE INSERT OR UPDATE ON public.birthday_greetings
  FOR EACH ROW EXECUTE FUNCTION public.tg_birthday_greeting_guard_family();

-- ── VERIFY ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = 'birthday_greetings') THEN
    RAISE EXCEPTION 'birthday_greetings does not have RLS enabled';
  END IF;

  -- EXACTLY ONE POLICY, AND IT IS THE SELECT. A write policy appearing here would open the
  -- table to the browser, and §2c means that is the entire difference between "the actions
  -- own the writes" and "anybody signed in owns them".
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'birthday_greetings') <> 1 THEN
    RAISE EXCEPTION 'birthday_greetings should have exactly one policy, its SELECT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'birthday_greetings'
       AND cmd = 'SELECT'
       AND qual LIKE '%auth_family_code%'
       AND qual LIKE '%auth_membership_approved%'
  ) THEN
    RAISE EXCEPTION 'the birthday_greetings SELECT policy is not family-and-approval scoped';
  END IF;

  -- NO `permission_table_map` ROW, and asserted in that direction: a future policy sweep
  -- composes from that table, so a row appearing there later would put an
  -- `auth_permission('community/announcements', …)` factor onto this table — and `view`
  -- defaults to `'everyone'`, so it would not obviously break anything while making the
  -- dashboard band unrenderable for a family that restricted announcements.
  IF EXISTS (SELECT 1 FROM public.permission_table_map WHERE table_name = 'birthday_greetings') THEN
    RAISE EXCEPTION 'birthday_greetings must not have a permission_table_map row — see the header';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.birthday_greetings'::regclass
       AND tgname = 'birthday_greetings_guard_family'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'the birthday_greetings family guard trigger is missing';
  END IF;

  RAISE NOTICE 'birthday_greetings: one SELECT policy, no write policy, guard trigger on.';
END $$;
