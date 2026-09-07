const { supabase } = require("../config/supabase");

// ==========================================================
// BEATS INFINITY - ADMIN AUTH MIDDLEWARE
// ==========================================================
//
// Validates the Bearer session token issued by
// POST /api/v1/admin/login against admin_users.session_token.
//
// requireAdmin   -> role "admin" or "super_admin"
// requireSuperAdmin -> role "super_admin" only
// ==========================================================

const authenticate = async (req, res) => {

    const authHeader =
        req.headers.authorization || "";

    const token =
        authHeader.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : null;

    if (!token) {

        res.status(401).json({

            success: false,

            message:
                "Authentication required."

        });

        return null;

    }


    const {
        data: admin,
        error
    } = await supabase

        .from("admin_users")

        .select(
            "id,username,full_name,role,session_expires_at"
        )

        .eq(
            "session_token",
            token
        )

        .maybeSingle();


    if (error) {

        console.error(
            "ADMIN AUTH LOOKUP:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Unable to verify session."

        });

        return null;

    }


    if (!admin) {

        res.status(401).json({

            success: false,

            message:
                "Invalid or expired session. Please log in again."

        });

        return null;

    }


    if (
        !admin.session_expires_at ||
        new Date(admin.session_expires_at).getTime() <
        Date.now()
    ) {

        res.status(401).json({

            success: false,

            message:
                "Session expired. Please log in again."

        });

        return null;

    }


    return admin;

};


const requireAdmin = async (req, res, next) => {

    const admin =
        await authenticate(req, res);

    if (!admin) {

        return;

    }


    req.admin = admin;

    next();

};


const requireSuperAdmin = async (req, res, next) => {

    const admin =
        await authenticate(req, res);

    if (!admin) {

        return;

    }


    if (admin.role !== "super_admin") {

        return res.status(403).json({

            success: false,

            message:
                "Super Admin access required."

        });

    }


    req.admin = admin;

    next();

};


module.exports = {
    requireAdmin,
    requireSuperAdmin
};
