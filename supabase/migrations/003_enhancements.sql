-- supabase/migrations/003_enhancements.sql
-- Run in Supabase SQL Editor

-- 1. Add expires_at to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2. Add avatar_url to profiles  
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 3. Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars', 
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
