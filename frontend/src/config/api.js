// ==========================================================
// BEATS INFINITY - API CONFIGURATION
// ==========================================================
//
// Single source of truth for the backend base URL.
//
// Set VITE_API_BASE_URL in .env / .env.production to point
// at the correct backend for each environment.
// ==========================================================

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000";

const API_V1_URL =
    `${API_BASE_URL}/api/v1`;

export {
    API_BASE_URL,
    API_V1_URL
};
