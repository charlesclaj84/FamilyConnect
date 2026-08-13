-- ============================================================================
-- Four captions on the permission grid, two sub-headings, and one row's position.
--
-- AGENTS.md, "One rail item, one permission resource": *Captions come from the
-- screen.* An administrator matching a switch to the thing it switches off should not
-- have to translate, so when a page is retitled its `permission_resources.label` is
-- retitled with it. Four pages were retitled in one pass, all in the same direction —
-- dropping a qualifier the surrounding structure already supplies:
--
--   members         Member Directory  -> Directory
--                   It sits under a Community heading, beside Chat and Announcements,
--                   where the only thing it could be a directory OF is the family.
--
--   admin/family    Family Settings   -> Settings
--                   Every page under Administration is about the one family the caller
--                   is acting in, and the heading above it has already said so.
--
--   admin/users     Members & Access  -> Members
--                   "& Access" recorded that this page had absorbed Groups &
--                   Permissions (20260807000000). Two renames later it is the only
--                   members screen an administrator has, and the qualifier was only
--                   competing with Community > Directory for the word "members".
--
--   account-summary My Summary        -> Summary
--                   The possessive ran down four labels in a row. What makes this page
--                   the caller's own is the unconditional `person_id = auth_person_id()`
--                   on every policy behind it, not the word "My" in its title.
--
-- TWO SUB-HEADINGS MOVE WITH THEM, and they have to: `subsection` is the sub-heading
-- the grid prints above a block of rows, and 20260808000000 set both of these to the
-- caption of the page whose tabs they are. Left alone they would name pages that no
-- longer exist by those names.
--
--   'Members & Access' -> 'Members'   over admin/approvals + admin/users/templates
--   'My Summary'       -> 'Summary'   over the three account-summary/* panes
--
-- NO KEY CHANGES, and that is the point of doing this as a label update rather than a
-- rename. Every one of these keys is wired into permission_table_map, into RLS
-- expressions composed at migration time by 20260618000001, and into template_permissions
-- rows already issued to every family. A key rename would orphan all of it to retitle a
-- heading; the routes (`/members`, `/admin/family`, `/admin/users`, `/account-summary`)
-- stay put for exactly the same reason.
--
-- ── AND ONE ORDER ───────────────────────────────────────────────────────────
-- `admin/family` moves from sort_order 155 to 260 — from the TOP of the Administration
-- block to the bottom, after admin/announcements (250).
--
-- 20260812000000 chose 155 on the argument that "which family is this" reads first in
-- a catalogue of switches, and it left the sidebar disagreeing with the grid: the rail
-- put Settings second, because Members has PEOPLE waiting in its approvals queue and
-- nothing waits behind Settings. That disagreement was documented in
-- components/layout/Sidebar.tsx as "the one place this list and the permission grid
-- disagree", which is a footnote a reader has to hold in their head forever.
--
-- Both now agree, and on the simpler rule: Settings is the thing you set up once and
-- then leave alone, so it belongs where a reader stops looking rather than where they
-- start. The sidebar list moved in the same commit.
--
-- Nothing reads sort_order except the grid's own ordering (groupResources in
-- components/admin/resource-groups.ts) and the seeding loops, which walk the table
-- rather than a literal list. There is no grant, policy or fetch keyed on it.
--
-- THE LABELS ARE ALSO UPDATED IN THE SEED in 20260618000000, whose insert is
-- ON CONFLICT DO UPDATE on label/category/sort_order and would otherwise revert them on
-- a `db reset`. This file is what reaches hosted; that edit is what makes a fresh local
-- database match it. AGENTS.md §6.
--
-- APPLIED BY: `supabase db push`, from CI on merge to master.
-- ============================================================================

BEGIN;

-- ── 1. The four captions ────────────────────────────────────────────────────
UPDATE public.permission_resources SET label = 'Directory' WHERE key = 'members';
UPDATE public.permission_resources SET label = 'Members'   WHERE key = 'admin/users';
UPDATE public.permission_resources SET label = 'Summary'   WHERE key = 'account-summary';
UPDATE public.permission_resources
   SET label = 'Settings', sort_order = 260
 WHERE key = 'admin/family';

-- ── 2. The two sub-headings ─────────────────────────────────────────────────
-- Matched on the OLD value rather than on a list of keys, so a resource filed under
-- either heading after this migration was written moves with the rest of its block
-- instead of being left behind under a heading nothing else uses.
UPDATE public.permission_resources
   SET subsection = 'Members'
 WHERE subsection = 'Members & Access';

UPDATE public.permission_resources
   SET subsection = 'Summary'
 WHERE subsection = 'My Summary';

-- ── 3. Say so if any of it applied to nothing ───────────────────────────────
-- Every key below is seeded by 20260618000000 and three of them are re-asserted by
-- later files, so all four must exist by the time this runs. A silent zero-row UPDATE
-- would leave the grid showing an old caption with nothing anywhere saying so — the
-- same "a skip must be visible" rule the migration verify blocks follow.
--
-- The sub-headings are NOT asserted: they are set by 20260808000000, which is in the
-- chain ahead of this file, but a family database restored from before it would have
-- neither the rows nor the headings, and failing the deploy over a heading that has
-- nothing to rename would be a worse outcome than the heading being absent.
DO $$
DECLARE
  missing TEXT;
BEGIN
  SELECT string_agg(k, ', ') INTO missing
    FROM unnest(ARRAY['members', 'admin/users', 'account-summary', 'admin/family']) AS k
   WHERE NOT EXISTS (SELECT 1 FROM public.permission_resources WHERE key = k);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'permission_resources is missing %, so the rename applied to nothing', missing;
  END IF;
END $$;

COMMIT;
