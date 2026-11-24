// ==========================================================
// BEATS INFINITY - SHARED PAYMENT RULES
// ==========================================================

// Registration fee per singer per event
const PAYMENT_AMOUNT = 700;

const PAYMENT_TYPE_REGISTRATION = "Singer Registration";

// Added on the Final List on event day; pays cash on the spot
const PAYMENT_TYPE_WALK_IN = "Walk-in";

// Free entry (stored as Paid at Rs 0) - see
// migrations/2026-11-24_walk_in_fee_waiver.sql
const FEE_WAIVERS = ["Guest Singer", "Management Team"];

const FEE_WAIVER_MIGRATION_MESSAGE =
    "Free entry needs a database update - run backend/migrations/2026-11-24_walk_in_fee_waiver.sql in Supabase first.";

const isWalkIn = payment =>
    payment?.payment_type === PAYMENT_TYPE_WALK_IN;

const isFeeWaived = payment =>
    Boolean(payment?.fee_waiver);

// The fee_waiver column or the relaxed amount check is missing
const isMissingWaiverMigration = error =>
    /fee_waiver|payments_amount_check/i.test(error?.message || "");

module.exports = {
    PAYMENT_AMOUNT,
    PAYMENT_TYPE_REGISTRATION,
    PAYMENT_TYPE_WALK_IN,
    FEE_WAIVERS,
    FEE_WAIVER_MIGRATION_MESSAGE,
    isWalkIn,
    isFeeWaived,
    isMissingWaiverMigration
};
