-- ==========================================================
-- BEATS INFINITY - WALK-INS + FREE ENTRY (Guest / Management)
-- ==========================================================
--
-- 1. payments.amount may now be 0. A free entry (guest singer or
--    management team) is stored as Paid at Rs 0, so every revenue
--    total stays right without special cases.
--
-- 2. payments.fee_waiver - why a payment is free:
--      NULL               normal paying singer
--      'Guest Singer'     guest, sings as a goodwill gesture
--      'Management Team'  core team, doesn't pay
--
-- Walk-ins (singers added on the Final List on event day) are
-- marked with payment_type = 'Walk-in' - no schema change needed.
--
-- Safe to run more than once. Run in the Supabase SQL editor.
-- ==========================================================

alter table public.payments
    drop constraint if exists payments_amount_check;

alter table public.payments
    add constraint payments_amount_check
        check (amount >= 0);

alter table public.payments
    add column if not exists fee_waiver text;

alter table public.payments
    drop constraint if exists payments_fee_waiver_check;

alter table public.payments
    add constraint payments_fee_waiver_check
        check (
            fee_waiver is null
            or fee_waiver in ('Guest Singer', 'Management Team')
        );
