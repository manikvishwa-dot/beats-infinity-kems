-- ==========================================================
-- BEATS INFINITY - SECURE FORGOT PIN
-- ==========================================================
--
-- Forgot-PIN OTPs are no longer shown on screen. An admin sends
-- them on WhatsApp from the "PIN Resets" admin page.
--
--   attempts - wrong guesses so far (max 5, then a new request
--              is needed) - stops guessing all 1,000,000 codes
--   used_at  - set when the OTP has been used to reset a PIN,
--              so the same OTP can't reset the PIN twice
--   sent_at  - set when an admin sends the OTP on WhatsApp,
--              shown as "Sent" on the admin page
--
-- Only adds columns; existing rows are untouched.
-- Run once in the Supabase SQL editor.
-- ==========================================================

alter table public.singer_otps
    add column if not exists attempts integer not null default 0,
    add column if not exists used_at timestamptz,
    add column if not exists sent_at timestamptz;
