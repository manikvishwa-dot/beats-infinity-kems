const { supabase } = require("../../config/supabase");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// ==========================================================
// BEATS INFINITY - ADMIN AUTH CONTROLLER
// ==========================================================
//
// Separate from singer auth (mobile + PIN). Admin/Super Admin
// accounts use a username + password against admin_users.
//
// role = "admin"       -> operational dashboard, payments, pairing
// role = "super_admin" -> everything admin can do, PLUS finance
// ==========================================================

const SESSION_DURATION_MS =
    12 * 60 * 60 * 1000; // 12 hours


// ==========================================================
// LOGIN
//
// POST /api/v1/admin/login
//
// Body:
// {
//     "username": "...",
//     "password": "...",
//     "require_role": "super_admin"   (optional)
// }
//
// require_role is sent by the Super Admin login page only,
// to reject an "admin"-role account trying to log in there.
// ==========================================================

const login = async (req, res) => {

    try {

        const {
            username,
            password,
            require_role
        } = req.body || {};


        if (!username || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Username and password are required."

            });

        }


        const {
            data: admin,
            error
        } = await supabase

            .from("admin_users")

            .select("*")

            .eq(
                "username",
                String(username).trim()
            )

            .maybeSingle();


        if (error) {

            console.error(
                "ADMIN LOGIN LOOKUP:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to login.",

                error:
                    error.message

            });

        }


        if (!admin) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid username or password."

            });

        }


        const passwordMatches =
            await bcrypt.compare(
                String(password),
                admin.password_hash
            );


        if (!passwordMatches) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid username or password."

            });

        }


        if (
            require_role &&
            admin.role !== require_role
        ) {

            return res.status(403).json({

                success: false,

                message:
                    require_role === "super_admin"
                        ? "This account does not have Super Admin access."
                        : "This account is not permitted to log in here."

            });

        }


        const token =
            crypto.randomBytes(32).toString("hex");

        const expiresAt =
            new Date(
                Date.now() + SESSION_DURATION_MS
            ).toISOString();


        const {
            data: updated,
            error: updateError
        } = await supabase

            .from("admin_users")

            .update({

                session_token:
                    token,

                session_expires_at:
                    expiresAt

            })

            .eq(
                "id",
                admin.id
            )

            .select(
                "id,username,full_name,role"
            )

            .single();


        if (updateError) {

            console.error(
                "ADMIN LOGIN SESSION UPDATE:",
                updateError
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to complete login.",

                error:
                    updateError.message

            });

        }


        console.log(
            "✅ Admin login successful:",
            updated.username,
            `(${updated.role})`
        );


        return res.status(200).json({

            success: true,

            message:
                "Login successful.",

            admin:
                updated,

            token,

            expires_at:
                expiresAt

        });

    }

    catch (error) {

        console.error(
            "ADMIN LOGIN EXCEPTION:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// LOGOUT
//
// POST /api/v1/admin/logout
// ==========================================================

const logout = async (req, res) => {

    try {

        const adminId =
            req.admin?.id;


        if (adminId) {

            await supabase

                .from("admin_users")

                .update({

                    session_token:
                        null,

                    session_expires_at:
                        null

                })

                .eq(
                    "id",
                    adminId
                );

        }


        return res.status(200).json({

            success: true,

            message:
                "Logged out."

        });

    }

    catch (error) {

        console.error(
            "ADMIN LOGOUT EXCEPTION:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Internal server error.",

            error:
                error.message

        });

    }

};


// ==========================================================
// CURRENT ADMIN
//
// GET /api/v1/admin/me
// ==========================================================

const me = async (req, res) => {

    return res.status(200).json({

        success: true,

        admin:
            req.admin

    });

};


// ==========================================================
// LIST ADMIN ACCOUNTS - SUPER ADMIN ONLY
//
// GET /api/v1/admin/users
//
// Just the two fixed accounts (admin, super_admin) - no
// password data, purely for the Super Admin "Change Password"
// section to know which account it's targeting.
// ==========================================================

const listAdminUsers = async (req, res) => {

    try {

        const {
            data,
            error
        } = await supabase

            .from("admin_users")

            .select("id,username,full_name,role")

            .order("role", { ascending: true });


        if (error) {

            console.error("LIST ADMIN USERS:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load admin accounts.",
                error: error.message
            });

        }


        return res.status(200).json({

            success: true,

            users:
                data || []

        });

    }

    catch (error) {

        console.error("LIST ADMIN USERS EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


// ==========================================================
// CHANGE PASSWORD - SUPER ADMIN ONLY
//
// PUT /api/v1/admin/users/:id/password
//
// Body: { new_password, current_password }
//
// current_password is required and verified ONLY when changing
// your OWN account (req.admin.id === :id) - a super admin resetting
// the OTHER account's password doesn't need to know its old one,
// their super_admin session is authority enough. Either way, the
// target account's active session is invalidated afterward so a
// changed password takes effect immediately.
// ==========================================================

const MIN_PASSWORD_LENGTH = 6;

const changeAdminPassword = async (req, res) => {

    try {

        const targetId = req.params.id;

        const {
            new_password,
            current_password
        } = req.body || {};


        if (!targetId) {

            return res.status(400).json({
                success: false,
                message: "Account ID is required."
            });

        }


        if (!new_password || String(new_password).length < MIN_PASSWORD_LENGTH) {

            return res.status(400).json({
                success: false,
                message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`
            });

        }


        const {
            data: target,
            error: lookupError
        } = await supabase

            .from("admin_users")

            .select("id,username,role,password_hash")

            .eq("id", targetId)

            .maybeSingle();


        if (lookupError) {

            console.error("CHANGE PASSWORD - LOOKUP:", lookupError);

            return res.status(500).json({
                success: false,
                message: "Unable to load account.",
                error: lookupError.message
            });

        }


        if (!target) {

            return res.status(404).json({
                success: false,
                message: "Account not found."
            });

        }


        const isOwnAccount =
            target.id === req.admin.id;


        if (isOwnAccount) {

            if (!current_password) {

                return res.status(400).json({
                    success: false,
                    message: "Current password is required to change your own password."
                });

            }

            const currentMatches =
                await bcrypt.compare(
                    String(current_password),
                    target.password_hash
                );

            if (!currentMatches) {

                return res.status(401).json({
                    success: false,
                    message: "Current password is incorrect."
                });

            }

        }


        const newHash =
            await bcrypt.hash(String(new_password), 10);


        const {
            error: updateError
        } = await supabase

            .from("admin_users")

            .update({

                password_hash:
                    newHash,

                // Force re-login on the target account - an old
                // session token shouldn't survive a password change.
                session_token:
                    null,

                session_expires_at:
                    null

            })

            .eq("id", targetId);


        if (updateError) {

            console.error("CHANGE PASSWORD - UPDATE:", updateError);

            return res.status(500).json({
                success: false,
                message: "Unable to update password.",
                error: updateError.message
            });

        }


        console.log(
            "🔑 Password changed for:",
            target.username,
            `(${target.role})`,
            isOwnAccount ? "[self]" : `[by ${req.admin.username}]`
        );


        return res.status(200).json({

            success: true,

            message:
                isOwnAccount
                    ? "Your password has been updated. Please log in again."
                    : `Password updated for ${target.username}.`,

            forced_logout:
                isOwnAccount

        });

    }

    catch (error) {

        console.error("CHANGE PASSWORD EXCEPTION:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message
        });

    }

};


module.exports = {
    login,
    logout,
    me,
    listAdminUsers,
    changeAdminPassword
};
