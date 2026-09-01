-- ═══════════════════════════════════════════════════════════════════════════════════════
-- A NOTIFICATION IS WRITTEN ONCE AND READ LATER, POSSIBLY IN ANOTHER LANGUAGE
--
-- Found 2026-09-01 by `npm run i18n:onscreen`, which is the only thing that could find it:
-- there is no unkeyed literal in a component, no formatter missing an argument, and both
-- static gates are clean. The English is in `lib/notifications.ts`, and it goes into the
-- DATABASE.
--
-- ── WHY THAT IS A DIFFERENT PROBLEM FROM AN UNKEYED CAPTION ─────────────────────────
-- Every other string in this product is chosen at RENDER time, when the reader is known. A
-- notification's text is chosen at EVENT time — when a relative submits a task, when an
-- applicant asks to join — and the reader is somebody else entirely, days later. So even a
-- perfectly translated writer would be wrong: it would compose the message in the language of
-- whoever happened to trigger it.
--
-- `lib/i18n/locales.ts` already argues this exact shape for MAIL: *"for a piece of mail that
-- header is the wrong browser entirely: it belongs to the administrator pressing Send, not to
-- the relative who will open the message."* A bell entry is the same fact one table over.
--
-- ── SO THE ROW STORES A KEY AND ITS PARAMETERS, AND THE BELL RENDERS ────────────────
--
--     title_key   'notify.membershipRequest.title'
--     body_key    'notify.membershipRequest.body'
--     params      {"who": "Martha Allen", "family": "The Allens"}
--
-- ── ADDITIVE, AND `title` STAYS. THAT IS THE DEPLOYMENT ARGUMENT ───────────────────
-- `title` is NOT NULL and every existing row has one. Dropping it would be the
-- `position_journal_entries.body` shape — a DROP COLUMN whose old code asks for a column that
-- is gone and gets 42703, killing the whole query — and AGENTS.md says that inverts the
-- deployment argument and costs an empty screen for one alias window.
--
-- It is not merely tolerated, either: it is the FALLBACK, and it earns its place three ways.
-- Rows written before today have no key. A `type` added later and not yet keyed still says
-- something. And a key that fails to resolve renders as the key, which on a bell is worse than
-- English — so the reader keeps the sentence the writer composed.
--
-- ── PARAMS ARE A `jsonb` OBJECT OF STRINGS, AND NOTHING ELSE ───────────────────────
-- No dates, no numbers, no nested objects. Everything interpolated into a notification today
-- is already a formatted string — a name, a clipped task label, a date the writer formatted —
-- and keeping it that way means the bell can hand the object straight to `t` with no coercion
-- and no locale-sensitive re-formatting of a value that was formatted once already.
--
-- A CHECK enforces it, because `jsonb` accepts anything and the failure would be a bell entry
-- rendering `[object Object]` at somebody who was told a relative is unsafe.
--
-- ── NOTHING HERE IS A POLICY CHANGE ───────────────────────────────────────────────
-- `notifications` keeps its policies exactly. The columns are text a recipient can already
-- read on the row they already own, and `20260821000002` publishes this table to realtime — so
-- the columns ride the same INSERT event the bell already subscribes to, with no change to the
-- publication and none to `REPLICA IDENTITY`.
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title_key TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body_key  TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS params    JSONB;

-- ── THE SHAPE TEST, AS A FUNCTION, BECAUSE A CHECK CANNOT HOLD A SUBQUERY ────────────
-- `CHECK (NOT EXISTS (SELECT …))` is refused outright: *"cannot use subquery in check
-- constraint"*. An IMMUTABLE function is the sanctioned way round it, and `jsonb_each` inside
-- one is fine — it reads nothing but its argument, which is what IMMUTABLE actually promises.
--
-- `SET search_path = ''` and every reference qualified, per AGENTS.md on `20260806000012`.
CREATE OR REPLACE FUNCTION public.jsonb_is_flat_strings(p_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $fn$
  SELECT p_value IS NULL
      OR (jsonb_typeof(p_value) = 'object'
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_each(p_value) AS e
             WHERE jsonb_typeof(e.value) <> 'string'))
$fn$;

-- ── IT NEEDS THE `authenticated` GRANT, AND THE FIRST DRAFT REVOKED IT ───────────────
-- That draft said "a constraint's expression runs as part of the write rather than as a call
-- the caller makes — so `authenticated` needs nothing." **That is wrong.** A CHECK constraint's
-- expression is evaluated with the privileges of whoever is performing the write, so revoking
-- EXECUTE makes every authenticated INSERT and UPDATE on this table fail with
-- "permission denied for function jsonb_is_flat_strings".
--
-- This is AGENTS.md §2b rule 2 — *"a function named in an RLS policy needs the grant too …
-- policy expressions are evaluated as the QUERYING role"* — arriving through a CHECK rather
-- than through a policy. Same rule, a surface that section does not name.
--
-- ── AND IT WAS FOUND BY THE RLS SUITE'S POSITIVE CONTROL, AGAIN ─────────────────────
-- `markNotificationRead`'s three cases went *"owner's own write did nothing"* while every
-- ATTACK half stayed green — because a function that errors refuses everybody equally. That is
-- §7's argument for the control half, and it is at least the fifth time in this repo.
--
-- A direct `SET LOCAL ROLE authenticated; UPDATE …` does NOT reproduce it: with no `auth.uid()`
-- the policy matches zero rows, so the CHECK is never reached and the statement reports
-- `UPDATE 0`. Only a real member updating their own row gets there.
--
-- GRANTING IT DISCLOSES NOTHING. It is a pure predicate over its own argument — it reads no
-- table, and its answer is a fact about a value the caller already holds.
GRANT EXECUTE ON FUNCTION public.jsonb_is_flat_strings(jsonb) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND conname = 'notifications_params_are_flat_strings'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_params_are_flat_strings
      -- An OBJECT whose every value is a string. An array, a bare scalar, a nested object, a
      -- number or a null would each reach `t` and interpolate as `[object Object]`, `1` or the
      -- word "null" — on a bell entry somebody is relying on.
      CHECK (public.jsonb_is_flat_strings(params));
  END IF;
END $$;

COMMENT ON COLUMN public.notifications.title_key IS
  'Catalogue key for the title, rendered in the READER''s language by NotificationBell. NULL on '
  'rows written before 20260901000004, and on any type not yet keyed — `title` is the fallback '
  'and stays for exactly that reason.';

COMMENT ON COLUMN public.notifications.body_key IS
  'Catalogue key for the body. NULL where there is no body or none is keyed yet.';

COMMENT ON COLUMN public.notifications.params IS
  'Interpolation values for the two keys. A FLAT OBJECT OF STRINGS, enforced by CHECK: '
  'everything a notification interpolates is already a formatted string, and anything else '
  'renders as [object Object] on a bell entry.';

-- ── VERIFY ─────────────────────────────────────────────────────────────────────────────
DO $mig$
DECLARE
  v_code   TEXT := 'NOTIFKEY';
  v_person UUID;
  v_n      INT;
BEGIN
  FOR v_n IN
    SELECT 1 FROM (SELECT unnest(ARRAY['title_key','body_key','params']) AS c) x
     WHERE NOT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='notifications' AND column_name=x.c)
  LOOP
    RAISE EXCEPTION 'ROLLBACK: a keyed-notification column is missing';
  END LOOP;

  -- THE GRANT. Without it every authenticated write to this table fails, and the failure is
  -- invisible to a direct probe (see the note above the GRANT) — so it is asserted here rather
  -- than trusted.
  IF NOT has_function_privilege('authenticated',
       'public.jsonb_is_flat_strings(jsonb)', 'EXECUTE')
  THEN
    RAISE EXCEPTION
      'ROLLBACK: authenticated cannot execute jsonb_is_flat_strings — a CHECK expression runs '
      'as the querying role, so every notification write would fail';
  END IF;

  -- `title` MUST STILL BE NOT NULL. It is the fallback, and a migration that relaxed it would
  -- let a writer store a key with no English behind it — which renders as the key itself the
  -- first time a catalogue entry is missing.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='notifications'
       AND column_name='title' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: notifications.title is nullable — the fallback is gone';
  END IF;

  INSERT INTO public.families (family_code, family_name) VALUES (v_code, 'Notify probe');
  INSERT INTO public.people (family_code, first_name, last_name, primary_email)
       VALUES (v_code, 'Notify', 'Probe', 'notify-probe@genorra.com')
    RETURNING id INTO v_person;

  -- A flat object of strings is accepted.
  INSERT INTO public.notifications
              (family_code, recipient_id, type, title, title_key, params)
       VALUES (v_code, v_person, 'probe', 'A probe', 'notify.probe.title',
               '{"who":"Martha Allen"}'::jsonb);

  -- And every other shape is refused. Each of these renders as visible nonsense on a bell.
  FOR v_n IN SELECT 1 LOOP
    BEGIN
      INSERT INTO public.notifications (family_code, recipient_id, type, title, params)
           VALUES (v_code, v_person, 'probe', 'A probe', '{"n":1}'::jsonb);
      RAISE EXCEPTION 'ROLLBACK: params accepted a number';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.notifications (family_code, recipient_id, type, title, params)
           VALUES (v_code, v_person, 'probe', 'A probe', '{"o":{"a":"b"}}'::jsonb);
      RAISE EXCEPTION 'ROLLBACK: params accepted a nested object';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.notifications (family_code, recipient_id, type, title, params)
           VALUES (v_code, v_person, 'probe', 'A probe', '["a"]'::jsonb);
      RAISE EXCEPTION 'ROLLBACK: params accepted an array';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.notifications (family_code, recipient_id, type, title, params)
           VALUES (v_code, v_person, 'probe', 'A probe', '{"x":null}'::jsonb);
      RAISE EXCEPTION 'ROLLBACK: params accepted a null value';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;

  DELETE FROM public.notifications WHERE family_code = v_code;
  DELETE FROM public.people WHERE id = v_person;
  DELETE FROM public.families WHERE family_code = v_code;

  RAISE NOTICE 'notifications: title_key/body_key/params added, title still NOT NULL, and the '
               'flat-strings CHECK refuses a number, a nested object, an array and a null';
END $mig$;

COMMIT;
