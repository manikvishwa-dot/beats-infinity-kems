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


module.exports = {
    login,
    logout,
    me
};
