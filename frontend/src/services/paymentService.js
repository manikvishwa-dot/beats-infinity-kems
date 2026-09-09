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

const getPayments = async (status = "All", eventId = "") => {
    const params = new URLSearchParams();

    if (status && status !== "All") {
        params.set("status", status);
    }

    if (eventId) {
        params.set("event_id", eventId);
    }

    const query = params.toString() ? `?${params.toString()}` : "";

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

// ==========================================================
// ADMIN - ADD ONE SONG TO AN EXISTING PAYMENT
// ==========================================================

const addSongToPayment = async (paymentId, songId) => {
    const response = await fetch(
        `${API_BASE_URL}/${paymentId}/add-song`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({
                song_id: songId
            })
        }
    );

    return handleResponse(response);
};

// ==========================================================
// ADMIN - REMOVE ONE SONG FROM A PAYMENT (UNLINK, NOT DELETE)
// ==========================================================

const removeSongFromPayment = async (paymentId, songId) => {
    const response = await fetch(
        `${API_BASE_URL}/${paymentId}/remove-song`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({
                song_id: songId
            })
        }
    );

    return handleResponse(response);
};

// ==========================================================
// ADMIN - REPLACE ONE SONG IN A PAYMENT
// ==========================================================

const replaceSongInPayment = async (paymentId, oldSongId, newSongId) => {
    const response = await fetch(
        `${API_BASE_URL}/${paymentId}/replace-song`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({
                old_song_id: oldSongId,
                new_song_id: newSongId
            })
        }
    );

    return handleResponse(response);
};

// ==========================================================
// ADMIN - REASSIGN A SONG TO A DIFFERENT SINGER
// ==========================================================

const reassignSongToSinger = async (songId, fromSingerId, toSingerId, eventId) => {
    const response = await fetch(
        `${API_BASE_URL}/reassign-song`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({
                song_id: songId,
                from_singer_id: fromSingerId,
                to_singer_id: toSingerId,
                event_id: eventId
            })
        }
    );

    return handleResponse(response);
};

export {
    createPayment,
    addSongToPayment,
    removeSongFromPayment,
    replaceSongInPayment,
    reassignSongToSinger,
    getMyPayment,
    getPayments,
    markPaymentAsPaid,
    rejectPayment,
    bulkUpdatePaymentStatus
};
