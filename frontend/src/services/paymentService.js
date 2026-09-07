// ==========================================================
// BEATS INFINITY - PAYMENT API SERVICE
// ==========================================================

import { API_V1_URL } from "../config/api";
import { getAuthHeader } from "./adminService";

const API_BASE_URL =
    `${API_V1_URL}/payments`;

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
            "Payment request failed."
        );
    }

    return data;
};

// ==========================================================
// CREATE / NOTIFY PAYMENT
// ==========================================================

const createPayment = async (
    singerId,
    selectedSongIds
) => {
    const response = await fetch(
        API_BASE_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                singer_id: singerId,
                selected_song_ids: selectedSongIds
            })
        }
    );

    return handleResponse(response);
};

// ==========================================================
// GET LATEST PAYMENT FOR SINGER
// ==========================================================

const getMyPayment = async (singerId) => {
    const response = await fetch(
        `${API_BASE_URL}/my?singer_id=${encodeURIComponent(
            singerId
        )}`
    );

    return handleResponse(response);
};

// ==========================================================
// ADMIN - GET PAYMENTS
// ==========================================================

const getPayments = async (status = "All") => {
    const query =
        status && status !== "All"
            ? `?status=${encodeURIComponent(status)}`
            : "";

    const response = await fetch(
        `${API_BASE_URL}${query}`,
        {
            headers: {
                ...getAuthHeader()
            }
        }
    );

    return handleResponse(response);
};

// ==========================================================
// ADMIN - MARK PAID
// ==========================================================

const markPaymentAsPaid = async (paymentId) => {
    const response = await fetch(
        `${API_BASE_URL}/${paymentId}/mark-paid`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            }
        }
    );

    return handleResponse(response);
};

// ==========================================================
// ADMIN - REJECT
// ==========================================================

const rejectPayment = async (paymentId) => {
    const response = await fetch(
        `${API_BASE_URL}/${paymentId}/reject`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            }
        }
    );

    return handleResponse(response);
};

// ==========================================================
// ADMIN - BULK UPDATE STATUS (Excel import)
// ==========================================================

const bulkUpdatePaymentStatus = async (rows) => {
    const response = await fetch(
        `${API_BASE_URL}/bulk-status`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ rows })
        }
    );

    return handleResponse(response);
};

export {
    createPayment,
    getMyPayment,
    getPayments,
    markPaymentAsPaid,
    rejectPayment,
    bulkUpdatePaymentStatus
};
