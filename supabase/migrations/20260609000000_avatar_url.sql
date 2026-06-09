-- Add avatar_url to people + create storage buckets for avatars, documents, and event photos

ALTER TABLE people ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Avatars bucket (public — profile photos are not sensitive)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- Documents bucket (auth required)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 26214400)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents_auth_read"   ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "documents_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "documents_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "documents_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- Event photos bucket (public — event memories are shareable)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-photos', 'event-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "event_photos_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'event-photos');
CREATE POLICY "event_photos_auth_insert"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "event_photos_auth_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'event-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "event_photos_auth_delete"  ON storage.objects FOR DELETE USING (bucket_id = 'event-photos' AND auth.uid() IS NOT NULL);
