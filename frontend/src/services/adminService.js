// ==========================================================
// BEATS INFINITY - ADMIN AUTH SERVICE
// ==========================================================

import { API_V1_URL } from "../config/api";

const API_BASE_URL =
    `${API_V1_URL}/admin`;

const STORAGE_KEY =
    "beatsInfinityAdmin";


const handleResponse = async (response) => {

    let data = {};

    try {

        data = await response.json();

    }
    catch {

        data = {};

    }


    if (!response.ok) {

        throw new Error(
            data?.message ||
            data?.error ||
            "Request failed."
        );

    }


    return data;

};


// ==========================================================
// LOGIN
//
// requireRole: "super_admin" when called from the Super Admin
// login page, so an "admin"-role account is rejected there.
// ==========================================================

const login = async (
    username,
    password,
    requireRole
) => {

    const response = await fetch(

        `${API_BASE_URL}/login`,

        {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                username,

                password,

                require_role:
                    requireRole ||
                    undefined

            })

        }

    );


    const data =
        await handleResponse(response);


    if (
        data.success &&
        data.token
    ) {

        localStorage.setItem(

            STORAGE_KEY,

            JSON.stringify({

                admin:
                    data.admin,

                token:
                    data.token,

                expiresAt:
                    data.expires_at

            })

        );

    }


    return data;

};


// ==========================================================
// GET CURRENT SESSION
//
// Returns null if there is no session, or it has expired
// locally (the backend is still the source of truth for
// actual validity/expiry).
// ==========================================================

const getSession = () => {

    try {

        const raw =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!raw) {

            return null;

        }


        const session =
            JSON.parse(raw);


        if (!session?.token) {

            return null;

        }


        if (
            session.expiresAt &&
            new Date(session.expiresAt).getTime() <
            Date.now()
        ) {

            localStorage.removeItem(
                STORAGE_KEY
            );

            return null;

        }


        return session;

    }

    catch {

        return null;

    }

};


// ==========================================================
// AUTH HEADER
//
// Spread into fetch() headers for admin-protected endpoints.
// ==========================================================

const getAuthHeader = () => {

    const session =
        getSession();


    return session?.token
        ? { Authorization: `Bearer ${session.token}` }
        : {};

};


// ==========================================================
// LOGOUT
// ==========================================================

const logout = async () => {

    const session =
        getSession();


    localStorage.removeItem(
        STORAGE_KEY
    );


    if (!session?.token) {

        return;

    }


    try {

        await fetch(

            `${API_BASE_URL}/logout`,

            {

                method: "POST",

                headers: {
                    Authorization: `Bearer ${session.token}`
                }

            }

        );

    }

    catch {

        // Best-effort only - local session is already cleared.

    }

};


export {
    login,
    logout,
    getSession,
    getAuthHeader
};
