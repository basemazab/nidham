-- 075: In-app notifications table for mobile UX enhancement
-- Part of Phase 8 — Mobile UX Enhancement
-- Creates a notifications table for in-app push-style notifications

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'general',
  link_url      TEXT,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_all
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Add push columns to user_sessions (if not already there)
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS push_subscription JSONB,
  ADD COLUMN IF NOT EXISTS push_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_name    TEXT;

-- Peer role that can send notifications to company users
-- Adds: company_notifications
CREATE POLICY "Company members can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_roles cr
      JOIN company_role_permissions crp ON crp.role_id = cr.role_id
      JOIN permission_defs pd ON pd.id = crp.permission_id
      WHERE cr.user_id = auth.uid()
        AND cr.company_id = notifications.company_id
        AND pd.slug IN ('company_notifications', 'owner')
    )
  );
