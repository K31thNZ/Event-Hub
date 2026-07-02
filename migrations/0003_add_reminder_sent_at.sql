-- Migration: 0003_add_reminder_sent_at
-- Adds a persistent reminder dedup column to orders.
-- NULL  = reminder not yet sent for this order.
-- value = timestamp when the Telegram reminder was delivered.
-- This replaces the previous in-memory Set approach, which lost state
-- on every server restart (causing duplicate reminders after Render spin-up).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ DEFAULT NULL;
