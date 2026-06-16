-- ============================================================================
-- SECURITY FIX: stop trusting auth.jwt() -> 'user_metadata' in RLS policies.
--
-- user_metadata is editable by end users (supabase.auth.updateUser({ data }))
-- so any member could rewrite their own family_code and read/write another
-- family's data. Every family-scoped policy in this schema derived family_code
-- from user_metadata, so every one was spoofable.
--
-- Fix: derive the caller's family_code from their people row (keyed on the
-- non-spoofable auth.uid()) via a SECURITY DEFINER helper, and rebuild every
-- affected policy to call it instead of reading the JWT.
--
-- Why this is safe:
--   * auth.uid() comes from the verified JWT `sub` claim — users cannot forge it.
--   * The people row carrying family_code is written with the service-role admin
--     client at registration (see app/actions/register.ts), so it is the
--     authoritative source and a user cannot change their own family_code.
--   * SECURITY DEFINER runs the helper as the owner, bypassing RLS on people, so
--     using the helper inside people's OWN policies does not recurse.
--   * A user with no people row gets NULL → all family-scoped access denied
--     (fail closed).
-- ============================================================================

-- ── Helper ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_family_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT family_code
  FROM public.people
  WHERE user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_family_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_family_code() TO authenticated;

-- ── families (20260602000000) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "members can view own family" ON families;
CREATE POLICY "members can view own family"
  ON families FOR SELECT
  TO authenticated
  USING (family_code = public.auth_family_code());

-- ── people + person_relationships (20260602000003) ───────────────────────────
DROP POLICY IF EXISTS "family can view people" ON people;
CREATE POLICY "family can view people"
  ON people FOR SELECT
  TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family can insert people" ON people;
CREATE POLICY "family can insert people"
  ON people FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = auth.uid() OR user_id = auth.uid())
    AND (
      family_code = public.auth_family_code()
      -- Bootstrap: a user who does not yet have a people row (auth_family_code()
      -- IS NULL) may create their OWN row. This is the one path that cannot
      -- derive family_code from an existing row. Registration normally creates
      -- this row via the service-role client (see app/actions/register.ts), so
      -- this branch only fires as a fallback. UNIQUE(user_id) means it can run
      -- at most once per user, and the people DELETE policy forbids removing a
      -- row that still has user_id set — so an account cannot return to the
      -- no-row state to re-exploit it.
      OR (user_id = auth.uid() AND public.auth_family_code() IS NULL)
    )
  );

DROP POLICY IF EXISTS "users can update own or created people" ON people;
CREATE POLICY "users can update own or created people"
  ON people FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family can view relationships" ON person_relationships;
CREATE POLICY "family can view relationships"
  ON person_relationships FOR SELECT
  TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family can insert relationships" ON person_relationships;
CREATE POLICY "family can insert relationships"
  ON person_relationships FOR INSERT
  TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND created_by = auth.uid()
  );

-- ── chat (20260603000000) ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "family members can create rooms" ON chat_rooms;
CREATE POLICY "family members can create rooms"
  ON chat_rooms FOR INSERT TO authenticated
  WITH CHECK (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family members can be added as participants" ON chat_participants;
CREATE POLICY "family members can be added as participants"
  ON chat_participants FOR INSERT TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT id FROM chat_rooms
      WHERE family_code = public.auth_family_code()
    )
  );

-- ── admin events (20260604000000) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "family members can read user_roles" ON user_roles;
CREATE POLICY "family members can read user_roles"
  ON user_roles FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family members can read event_types" ON event_types;
CREATE POLICY "family members can read event_types"
  ON event_types FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family members can read blueprint_items" ON event_blueprint_items;
CREATE POLICY "family members can read blueprint_items"
  ON event_blueprint_items FOR SELECT TO authenticated
  USING (
    event_type_id IN (
      SELECT id FROM event_types
      WHERE family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family members can read published events" ON events;
CREATE POLICY "family members can read published events"
  ON events FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND status IN ('published', 'approved')
  );

DROP POLICY IF EXISTS "admins can read all family events" ON events;
CREATE POLICY "admins can read all family events"
  ON events FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family members can read assignments" ON event_assignments;
CREATE POLICY "family members can read assignments"
  ON event_assignments FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family members can read rsvps" ON event_rsvp;
CREATE POLICY "family members can read rsvps"
  ON event_rsvp FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family members can read rsvp_attendees" ON event_rsvp_attendees;
CREATE POLICY "family members can read rsvp_attendees"
  ON event_rsvp_attendees FOR SELECT TO authenticated
  USING (
    rsvp_id IN (
      SELECT r.id FROM event_rsvp r
      JOIN events e ON e.id = r.event_id
      WHERE e.family_code = public.auth_family_code()
    )
  );

-- ── chapters (20260604000002) ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "family members can read chapters" ON chapters;
CREATE POLICY "family members can read chapters"
  ON chapters FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

-- ── regions (20260604000005) ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "family members can read regions" ON regions;
CREATE POLICY "family members can read regions"
  ON regions FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

-- ── hotels (20260604000006) ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "family members can read hotel_bookings" ON event_hotel_bookings;
CREATE POLICY "family members can read hotel_bookings"
  ON event_hotel_bookings FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family members can read price_estimates" ON event_hotel_price_estimates;
CREATE POLICY "family members can read price_estimates"
  ON event_hotel_price_estimates FOR SELECT TO authenticated
  USING (
    hotel_booking_id IN (
      SELECT hb.id FROM event_hotel_bookings hb
      JOIN events e ON e.id = hb.event_id
      WHERE e.family_code = public.auth_family_code()
    )
  );

-- ── hotel details (20260604000008) ────────────────────────────────────────────
DROP POLICY IF EXISTS "family members can read hotel_details" ON event_hotel_booking_details;
CREATE POLICY "family members can read hotel_details"
  ON event_hotel_booking_details FOR SELECT TO authenticated
  USING (
    hotel_booking_id IN (
      SELECT hb.id FROM event_hotel_bookings hb
      JOIN events e ON e.id = hb.event_id
      WHERE e.family_code = public.auth_family_code()
    )
  );

-- ── announcements (20260609000001) ────────────────────────────────────────────
DROP POLICY IF EXISTS "family can view announcements" ON announcements;
CREATE POLICY "family can view announcements"
  ON announcements FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can insert announcements" ON announcements;
CREATE POLICY "admins can insert announcements"
  ON announcements FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND family_code = public.auth_family_code()
        AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins can update announcements" ON announcements;
CREATE POLICY "admins can update announcements"
  ON announcements FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND family_code = public.auth_family_code()
        AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "admins can delete announcements" ON announcements;
CREATE POLICY "admins can delete announcements"
  ON announcements FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND family_code = public.auth_family_code()
        AND is_admin = true
    )
  );

-- ── notifications (20260609000002) ────────────────────────────────────────────
DROP POLICY IF EXISTS "users can view own notifications" ON notifications;
CREATE POLICY "users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND recipient_id IN (
      SELECT id FROM people WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admins can insert notifications" ON notifications;
CREATE POLICY "admins can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND family_code = public.auth_family_code()
        AND is_admin = true
    )
  );

-- ── dues (20260609000003) ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "family can view dues schedules" ON dues_schedules;
CREATE POLICY "family can view dues schedules"
  ON dues_schedules FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage dues schedules" ON dues_schedules;
CREATE POLICY "admins can manage dues schedules"
  ON dues_schedules FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "family can view dues payments" ON dues_payments;
CREATE POLICY "family can view dues payments"
  ON dues_payments FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage dues payments" ON dues_payments;
CREATE POLICY "admins can manage dues payments"
  ON dues_payments FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

-- ── documents (20260609000004) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "family can view documents" ON documents;
CREATE POLICY "family can view documents"
  ON documents FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can insert documents" ON documents;
CREATE POLICY "admins can insert documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "admins can delete documents" ON documents;
CREATE POLICY "admins can delete documents"
  ON documents FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

-- ── event photos (20260609000005) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "family can view event photos" ON event_photos;
CREATE POLICY "family can view event photos"
  ON event_photos FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family can upload event photos" ON event_photos;
CREATE POLICY "family can upload event photos"
  ON event_photos FOR INSERT TO authenticated
  WITH CHECK (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "uploaders and admins can delete event photos" ON event_photos;
CREATE POLICY "uploaders and admins can delete event photos"
  ON event_photos FOR DELETE TO authenticated
  USING (
    uploader_id IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

-- ── elections (20260609000007) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "family can view elections" ON elections;
CREATE POLICY "family can view elections"
  ON elections FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage elections" ON elections;
CREATE POLICY "admins can manage elections"
  ON elections FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "family can view election positions" ON election_positions;
CREATE POLICY "family can view election positions"
  ON election_positions FOR SELECT TO authenticated
  USING (
    election_id IN (SELECT id FROM elections WHERE family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "admins can manage election positions" ON election_positions;
CREATE POLICY "admins can manage election positions"
  ON election_positions FOR ALL TO authenticated
  USING (
    election_id IN (
      SELECT id FROM elections WHERE family_code = public.auth_family_code()
    )
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    election_id IN (
      SELECT id FROM elections WHERE family_code = public.auth_family_code()
    )
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "family can view nominations" ON election_nominations;
CREATE POLICY "family can view nominations"
  ON election_nominations FOR SELECT TO authenticated
  USING (
    election_id IN (SELECT id FROM elections WHERE family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "family can submit nominations" ON election_nominations;
CREATE POLICY "family can submit nominations"
  ON election_nominations FOR INSERT TO authenticated
  WITH CHECK (
    election_id IN (SELECT id FROM elections WHERE family_code = public.auth_family_code() AND status = 'nominations')
  );

DROP POLICY IF EXISTS "admins can delete nominations" ON election_nominations;
CREATE POLICY "admins can delete nominations"
  ON election_nominations FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "admins can view all votes" ON election_votes;
CREATE POLICY "admins can view all votes"
  ON election_votes FOR SELECT TO authenticated
  USING (
    election_id IN (SELECT id FROM elections WHERE family_code = public.auth_family_code())
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "family can cast votes" ON election_votes;
CREATE POLICY "family can cast votes"
  ON election_votes FOR INSERT TO authenticated
  WITH CHECK (
    election_id IN (SELECT id FROM elections WHERE family_code = public.auth_family_code() AND status = 'voting')
    AND voter_id IN (SELECT id FROM people WHERE user_id = auth.uid())
  );

-- ── funds (20260610000000) ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "family can view funds" ON funds;
CREATE POLICY "family can view funds"
  ON funds FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can insert funds" ON funds;
CREATE POLICY "admins can insert funds"
  ON funds FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "admins can update funds" ON funds;
CREATE POLICY "admins can update funds"
  ON funds FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "admins can delete funds" ON funds;
CREATE POLICY "admins can delete funds"
  ON funds FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family can view fund_milestones" ON fund_milestones;
CREATE POLICY "family can view fund_milestones"
  ON fund_milestones FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can insert fund_milestones" ON fund_milestones;
CREATE POLICY "admins can insert fund_milestones"
  ON fund_milestones FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "admins can update fund_milestones" ON fund_milestones;
CREATE POLICY "admins can update fund_milestones"
  ON fund_milestones FOR UPDATE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "admins can delete fund_milestones" ON fund_milestones;
CREATE POLICY "admins can delete fund_milestones"
  ON fund_milestones FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family can view fund_disbursements" ON fund_disbursements;
CREATE POLICY "family can view fund_disbursements"
  ON fund_disbursements FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can insert fund_disbursements" ON fund_disbursements;
CREATE POLICY "admins can insert fund_disbursements"
  ON fund_disbursements FOR INSERT TO authenticated
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "admins can delete fund_disbursements" ON fund_disbursements;
CREATE POLICY "admins can delete fund_disbursements"
  ON fund_disbursements FOR DELETE TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

-- ── photo collections (20260610000001) ────────────────────────────────────────
DROP POLICY IF EXISTS "family can view photo_collections" ON photo_collections;
CREATE POLICY "family can view photo_collections"
  ON photo_collections FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family can create photo_collections" ON photo_collections;
CREATE POLICY "family can create photo_collections"
  ON photo_collections FOR INSERT TO authenticated
  WITH CHECK (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "creator or admin can update photo_collections" ON photo_collections;
CREATE POLICY "creator or admin can update photo_collections"
  ON photo_collections FOR UPDATE TO authenticated
  USING (
    created_by IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "creator or admin can delete photo_collections" ON photo_collections;
CREATE POLICY "creator or admin can delete photo_collections"
  ON photo_collections FOR DELETE TO authenticated
  USING (
    created_by IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family can view photos" ON photos;
CREATE POLICY "family can view photos"
  ON photos FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "family can upload photos" ON photos;
CREATE POLICY "family can upload photos"
  ON photos FOR INSERT TO authenticated
  WITH CHECK (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "uploader or admin can update photos" ON photos;
CREATE POLICY "uploader or admin can update photos"
  ON photos FOR UPDATE TO authenticated
  USING (
    uploader_id IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "uploader or admin can delete photos" ON photos;
CREATE POLICY "uploader or admin can delete photos"
  ON photos FOR DELETE TO authenticated
  USING (
    uploader_id IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family can view photo_tags" ON photo_tags;
CREATE POLICY "family can view photo_tags"
  ON photo_tags FOR SELECT TO authenticated
  USING (
    photo_id IN (
      SELECT p.id FROM photos p
      WHERE p.family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "family can create photo_tags" ON photo_tags;
CREATE POLICY "family can create photo_tags"
  ON photo_tags FOR INSERT TO authenticated
  WITH CHECK (
    photo_id IN (
      SELECT p.id FROM photos p
      WHERE p.family_code = public.auth_family_code()
    )
  );

DROP POLICY IF EXISTS "tagger or admin can delete photo_tags" ON photo_tags;
CREATE POLICY "tagger or admin can delete photo_tags"
  ON photo_tags FOR DELETE TO authenticated
  USING (
    tagged_by IN (SELECT id FROM people WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM people
      WHERE user_id = auth.uid()
        AND is_admin = true
        AND family_code = public.auth_family_code()
    )
  );

-- ── accounting (20260610000005) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "family can view dues_member_plans" ON dues_member_plans;
CREATE POLICY "family can view dues_member_plans"
  ON dues_member_plans FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage dues_member_plans" ON dues_member_plans;
CREATE POLICY "admins can manage dues_member_plans"
  ON dues_member_plans FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "members manage own dues_member_plans" ON dues_member_plans;
CREATE POLICY "members manage own dues_member_plans"
  ON dues_member_plans FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND person_id IN (SELECT id FROM people WHERE user_id = auth.uid())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND person_id IN (SELECT id FROM people WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "family can view fund_allocations" ON fund_allocations;
CREATE POLICY "family can view fund_allocations"
  ON fund_allocations FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage fund_allocations" ON fund_allocations;
CREATE POLICY "admins can manage fund_allocations"
  ON fund_allocations FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "family can view fund_contributions" ON fund_contributions;
CREATE POLICY "family can view fund_contributions"
  ON fund_contributions FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage fund_contributions" ON fund_contributions;
CREATE POLICY "admins can manage fund_contributions"
  ON fund_contributions FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "family can view event_budget_items" ON event_budget_items;
CREATE POLICY "family can view event_budget_items"
  ON event_budget_items FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage event_budget_items" ON event_budget_items;
CREATE POLICY "admins can manage event_budget_items"
  ON event_budget_items FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

DROP POLICY IF EXISTS "family can view event_expenses" ON event_expenses;
CREATE POLICY "family can view event_expenses"
  ON event_expenses FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage event_expenses" ON event_expenses;
CREATE POLICY "admins can manage event_expenses"
  ON event_expenses FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

-- ── family role exclusions (20260610000007) ───────────────────────────────────
DROP POLICY IF EXISTS "family can view role exclusions" ON family_role_exclusions;
CREATE POLICY "family can view role exclusions"
  ON family_role_exclusions FOR SELECT TO authenticated
  USING (family_code = public.auth_family_code());

DROP POLICY IF EXISTS "admins can manage role exclusions" ON family_role_exclusions;
CREATE POLICY "admins can manage role exclusions"
  ON family_role_exclusions FOR ALL TO authenticated
  USING (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  )
  WITH CHECK (
    family_code = public.auth_family_code()
    AND EXISTS (SELECT 1 FROM people WHERE user_id = auth.uid() AND is_admin = true AND family_code = public.auth_family_code())
  );

-- ── event type sub-templates (20260615000002) ─────────────────────────────────
DROP POLICY IF EXISTS "family members can read event_type_sub_templates" ON event_type_sub_templates;
CREATE POLICY "family members can read event_type_sub_templates"
  ON event_type_sub_templates FOR SELECT TO authenticated
  USING (
    parent_event_type_id IN (
      SELECT id FROM event_types
      WHERE family_code = public.auth_family_code()
    )
  );
