-- M2: Add user_settings table for cache version management
-- Execute in Supabase SQL Editor or with supabase-cli.

-- user_settings: store user-specific settings and cache versions
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  themes_cache_version INTEGER DEFAULT 1,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_settings
CREATE POLICY user_settings_select_self ON user_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_settings_insert_self ON user_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_settings_update_self ON user_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();