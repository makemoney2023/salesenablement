-- Migration: Add user profiles and authentication support
-- Run this in the Supabase SQL Editor to set up user authentication

-- ============================================
-- 1. User Profiles Table (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for role lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. Auto-update updated_at on profile changes
-- ============================================
DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. RLS Policies for user_profiles
-- ============================================

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from changing their own role
    role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update any profile
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete profiles (deactivate users)
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
CREATE POLICY "Admins can delete profiles"
  ON user_profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 5. Helper function to check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Helper function to get user role
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM user_profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Update existing table policies to use auth
-- ============================================

-- call_records: Allow authenticated users to access
DROP POLICY IF EXISTS "Allow all operations on call_records" ON call_records;
DROP POLICY IF EXISTS "Authenticated users can view call records" ON call_records;
DROP POLICY IF EXISTS "Authenticated users can insert call records" ON call_records;
DROP POLICY IF EXISTS "Authenticated users can update call records" ON call_records;
DROP POLICY IF EXISTS "Authenticated users can delete call records" ON call_records;

CREATE POLICY "Authenticated users can view call records"
  ON call_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert call records"
  ON call_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update call records"
  ON call_records FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete call records"
  ON call_records FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- call_notes: Allow authenticated users to access
DROP POLICY IF EXISTS "Allow all operations on call_notes" ON call_notes;
DROP POLICY IF EXISTS "Authenticated users can view call notes" ON call_notes;
DROP POLICY IF EXISTS "Authenticated users can insert call notes" ON call_notes;
DROP POLICY IF EXISTS "Authenticated users can update call notes" ON call_notes;
DROP POLICY IF EXISTS "Authenticated users can delete call notes" ON call_notes;

CREATE POLICY "Authenticated users can view call notes"
  ON call_notes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert call notes"
  ON call_notes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update call notes"
  ON call_notes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete call notes"
  ON call_notes FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- campaign_analytics: Allow authenticated users to access
DROP POLICY IF EXISTS "Allow all operations on campaign_analytics" ON campaign_analytics;
DROP POLICY IF EXISTS "Authenticated users can view analytics" ON campaign_analytics;
DROP POLICY IF EXISTS "Authenticated users can insert analytics" ON campaign_analytics;
DROP POLICY IF EXISTS "Authenticated users can update analytics" ON campaign_analytics;

CREATE POLICY "Authenticated users can view analytics"
  ON campaign_analytics FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert analytics"
  ON campaign_analytics FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update analytics"
  ON campaign_analytics FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- practitioners: Allow authenticated users to access
DROP POLICY IF EXISTS "Allow all operations on practitioners" ON practitioners;
DROP POLICY IF EXISTS "Authenticated users can view practitioners" ON practitioners;
DROP POLICY IF EXISTS "Authenticated users can insert practitioners" ON practitioners;
DROP POLICY IF EXISTS "Authenticated users can update practitioners" ON practitioners;
DROP POLICY IF EXISTS "Authenticated users can delete practitioners" ON practitioners;

CREATE POLICY "Authenticated users can view practitioners"
  ON practitioners FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert practitioners"
  ON practitioners FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update practitioners"
  ON practitioners FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete practitioners"
  ON practitioners FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- 8. Enable realtime for user_profiles
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;

-- ============================================
-- 9. Grant access to authenticated users
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
