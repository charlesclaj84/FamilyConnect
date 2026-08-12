-- ============================================================================
-- Does this database carry a policy that a later migration was supposed to have
-- replaced?
--
--   npx supabase db query --local  -f supabase/scripts/audit_policy_shadowing.sql
--   npx supabase db query --linked -f supabase/scripts/audit_policy_shadowing.sql
--
-- RAISEs on a finding, so it exits non-zero and reads as a test. Run it against
-- hosted after ANY hand intervention in the database.
--
-- WHAT IT IS LOOKING FOR
--   Permissive policies are OR-ed. Two policies on one table means a row is
--   readable if EITHER matches, so a superseded policy left in place beside its
--   replacement does not weaken access a little — it decides every read, and the
--   secure policy beside it becomes decoration.
--
--   This already happened in production. `20260602000000_families.sql` was replayed
--   against hosted after `20260618000001` had renamed its policy to `perm:…`. Its
--   bare `CREATE POLICY` — no DROP, no IF NOT EXISTS — recreated the original
--   `user_metadata` policy alongside the secure one, and the spoofable one won.
--   Supabase's advisor caught it; `20260806000009` removed it.
--
--   The shape is general. Every migration up to `20260610000007` creates policies
--   with a bare `CREATE POLICY`, and the three sweeps (`20260615000004`,
--   `20260618000001`, `20260618000003`) renamed or rewrote most of them. So
--   replaying any of those files re-adds a legacy policy under a name nothing holds
--   any more, and nothing in Postgres objects.
--
-- WHY THIS QUERY AND NOT A GUARD IN EVERY FILE
--   Guarding ~30 migrations individually is one edit per file, forever, and it is
--   only ever as complete as the last person's diligence. The structural fix is that
--   migrations reach hosted through `supabase db push` from CI and nowhere else —
--   `db push` consults `supabase_migrations.schema_migrations` and cannot replay a
--   recorded version. See "How migrations reach the hosted project" in AGENTS.md.
--
--   This file covers the one case that fix cannot: somebody with a connection string
--   running `psql -f` by hand. That records nothing and changes no version, so the
--   ledger check in `scripts/migrations.mjs` is blind to it. This is not.
--
-- WHY THE `perm:` PREFIX IS THE WHOLE TEST
--   `20260618000001` composes its policies by prefixing the name it replaces, so a
--   pair (`x`, `perm:x`) on one table is exactly the fingerprint of a replacement
--   that did not replace. That is a narrow test on purpose: it reports the shape
--   with a known cause and a known repair, rather than every table that happens to
--   carry two policies — many legitimately do.
-- ============================================================================

-- The findings go in the EXCEPTION message, not in RAISE WARNING beside it.
-- `supabase db query` surfaces the error and swallows NOTICE and WARNING, so a
-- run that reported the count in the exception and the culprits in warnings
-- would tell the operator that one policy is shadowed and never which one.
-- Measured, not assumed — that is exactly what the first version of this file did.
DO $$
DECLARE
  findings TEXT;
  found    INT;
BEGIN
  SELECT count(*), string_agg(format('%s.%s (%s, roles %s)', tablename, policyname, cmd, roles),
                              E'\n  ' ORDER BY tablename, policyname)
    INTO found, findings
    FROM pg_policies a
   WHERE a.schemaname = 'public'
     AND a.policyname NOT LIKE 'perm:%'
     AND EXISTS (
           SELECT 1
             FROM pg_policies b
            WHERE b.schemaname = 'public'
              AND b.tablename  = a.tablename
              AND b.policyname = 'perm:' || a.policyname
         );

  IF found > 0 THEN
    RAISE EXCEPTION E'% superseded polic% still present, each beside its "perm:" replacement:\n  %\n\n'
      'Permissive policies are OR-ed, so on those tables the superseded policy decides every read. '
      'Drop the unprefixed one and re-run. `20260806000009` is re-runnable and removes the '
      'user_metadata variety on sight; the is_admin variety and plain duplicates need doing by hand.',
      found, CASE WHEN found = 1 THEN 'y' ELSE 'ies' END, findings;
  END IF;
END $$;
