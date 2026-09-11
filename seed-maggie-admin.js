require("dotenv").config();

const bcrypt = require("bcryptjs");
const { supabase } = require("../config/supabase");

// ==========================================================
// SEED - DEFAULT ADMIN LOGIN (username: admin / password: beats.1234)
// ==========================================================
//
// One-time convenience seed for a local/staging admin_users row
// so the Admin dashboard (including Maggie) has a login out of
// the box. SAFE TO RUN MORE THAN ONCE - if a row with this
// username already exists, it is left untouched (this will NOT
// overwrite a real admin's password).
//
// Usage:
//   node scripts/seed-maggie-admin.js
//
// Change DEFAULT_PASSWORD below (or set it via the SEED_ADMIN_PASSWORD
// env var) before running this against a real/production database -
// "beats.1234" is a starting password, not one to keep.
// ==========================================================

const USERNAME = process.env.SEED_ADMIN_USERNAME || "admin";
const DEFAULT_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "beats.1234";
const ROLE = process.env.SEED_ADMIN_ROLE || "admin"; // "admin" or "super_admin"
const FULL_NAME = process.env.SEED_ADMIN_FULL_NAME || "Admin";

async function main() {

    const { data: existing, error: lookupError } = await supabase
        .from("admin_users")
        .select("id,username,role")
        .eq("username", USERNAME)
        .maybeSingle();

    if (lookupError) {
        console.error("❌ Unable to check for an existing admin_users row:", lookupError.message);
        process.exit(1);
    }

    if (existing) {
        console.log(
            `ℹ️  An admin_users row for "${USERNAME}" already exists (role: ${existing.role}). ` +
            "Leaving it untouched - this script never overwrites an existing password. " +
            "Use the Change Password feature in the dashboard if you need to reset it."
        );
        process.exit(0);
    }

    const passwordHash = await bcrypt.hash(String(DEFAULT_PASSWORD), 10);

    const { data: inserted, error: insertError } = await supabase
        .from("admin_users")
        .insert([{
            username: USERNAME,
            password_hash: passwordHash,
            role: ROLE,
            full_name: FULL_NAME
        }])
        .select("id,username,role")
        .single();

    if (insertError) {
        console.error("❌ Unable to create the admin_users row:", insertError.message);
        process.exit(1);
    }

    console.log(`✅ Created admin_users row "${inserted.username}" (role: ${inserted.role}).`);
    console.log(`   Login with username "${USERNAME}" and the password you seeded with.`);
    console.log("   Change it immediately after first login via the Change Password feature.");

    process.exit(0);

}

main().catch(error => {
    console.error("SEED FAILED:", error.message);
    process.exit(1);
});
