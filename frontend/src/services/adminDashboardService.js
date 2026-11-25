// ==========================================================
// BEATS INFINITY - ADMIN DASHBOARD / PAIRING SERVICE
// ==========================================================

import { API_V1_URL } from "../config/api";
import { getAuthHeader } from "./adminService";

const API_BASE_URL =
    `${API_V1_URL}/admin`;


const handleResponse = async response => {

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
// ALL SINGERS (ROSTER)
// ==========================================================

const getAllSingers = async () => {

    const response = await fetch(

        `${API_BASE_URL}/singers`,

        {
            headers: {
                ...getAuthHeader()
            }
        }

    );


    return handleResponse(response);

};


// ==========================================================
// SINGERS OVERVIEW
// ==========================================================

const getSingersOverview = async eventId => {

    const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : "";

    const response = await fetch(

        `${API_BASE_URL}/singers-overview${query}`,

        {
            headers: {
                ...getAuthHeader()
            }
        }

    );


    return handleResponse(response);

};


// ==========================================================
// PAIRING SUGGESTIONS
// ==========================================================

const getPairingSuggestions = async eventId => {

    const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : "";

    const response = await fetch(

        `${API_BASE_URL}/pairings/suggestions${query}`,

        {
            headers: {
                ...getAuthHeader()
            }
        }

    );


    return handleResponse(response);

};


// ==========================================================
// DECIDE PAIRING (approve / reject / manual)
// ==========================================================

const decidePairing = async (

    songId,

    maleSingerId,

    femaleSingerId,

    decision,

    source = "auto"

) => {

    const response = await fetch(

        `${API_BASE_URL}/pairings/decide`,

        {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },

            body: JSON.stringify({

                song_id: songId,

                male_singer_id: maleSingerId,

                female_singer_id: femaleSingerId,

                decision,

                source

            })

        }

    );


    return handleResponse(response);

};


// ==========================================================
// BULK UPDATE SINGERS (Excel import)
// ==========================================================

const bulkUpdateSingers = async rows => {

    const response = await fetch(

        `${API_BASE_URL}/singers/bulk`,

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
// BULK DECIDE PAIRINGS (Excel import)
// ==========================================================

const bulkDecidePairings = async (rows, eventId) => {

    const response = await fetch(

        `${API_BASE_URL}/pairings/bulk-decide`,

        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ rows, event_id: eventId })
        }

    );


    return handleResponse(response);

};


// ==========================================================
// DECIDE SOLO (approve / reject / undo with null)
// ==========================================================

const decideSolo = async (songId, decision) => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/solo`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ song_id: songId, decision })
        }
    );

    return handleResponse(response);

};


// ==========================================================
// FINAL PAIRING LIST (event-day list) + CHANGE LOG
// ==========================================================

const eventQuery = eventId =>
    eventId ? `?event_id=${encodeURIComponent(eventId)}` : "";

const getFinalPairingList = async eventId => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/final${eventQuery(eventId)}`,
        { headers: { ...getAuthHeader() } }
    );

    return handleResponse(response);

};

// Event day: tick a saved row as sung (saved at once)
const setFinalRowCompleted = async (eventId, ref, completed) => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/final/completed`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ event_id: eventId, ref, completed })
        }
    );

    return handleResponse(response);

};

// Roll back the last save (one level)
const getFinalListRollback = async eventId => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/final/rollback?event_id=${encodeURIComponent(eventId)}`,
        { headers: getAuthHeader() }
    );

    return handleResponse(response);

};

const rollbackFinalPairingList = async eventId => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/final/rollback`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ event_id: eventId })
        }
    );

    return handleResponse(response);

};

const saveFinalPairingList = async (eventId, rows) => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/final`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ event_id: eventId, rows })
        }
    );

    return handleResponse(response);

};

// singer: { singer_id } for an existing singer, or
//         { singer_name, gender, mobile_number, date_of_birth } for a new one
const addEventSinger = async (eventId, singer) => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/final/singers`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ event_id: eventId, ...singer })
        }
    );

    return handleResponse(response);

};

// Register names from an uploaded list: [{ singer_name, gender }]
const registerEventSingers = async (eventId, singers) => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/final/singers/bulk`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ event_id: eventId, singers })
        }
    );

    return handleResponse(response);

};

const getPairingChangeLog = async eventId => {

    const response = await fetch(
        `${API_BASE_URL}/pairings/change-log${eventQuery(eventId)}`,
        { headers: { ...getAuthHeader() } }
    );

    return handleResponse(response);

};


// ==========================================================
// SUPER ADMIN STATS - SINGERS PER EVENT (last 6 months)
// ==========================================================

const getSingersPerEvent = async () => {

    const response = await fetch(

        `${API_BASE_URL}/stats/singers-per-event`,

        {
            headers: {
                ...getAuthHeader()
            }
        }

    );


    return handleResponse(response);

};


// ==========================================================
// SUPER ADMIN STATS - FINANCE BY EVENT (last 6 months)
// ==========================================================

// Admin Dashboard charts - no money, any admin
const getDashboardOverview = async () => {

    const response = await fetch(
        `${API_BASE_URL}/stats/overview`,
        { headers: { ...getAuthHeader() } }
    );

    return handleResponse(response);

};

const getEventAnalytics = async () => {

    const response = await fetch(
        `${API_BASE_URL}/stats/event-analytics`,
        { headers: { ...getAuthHeader() } }
    );

    return handleResponse(response);

};

const getFinanceByEvent = async () => {

    const response = await fetch(

        `${API_BASE_URL}/stats/finance-by-event`,

        {
            headers: {
                ...getAuthHeader()
            }
        }

    );


    return handleResponse(response);

};


// ==========================================================
// MAGGIE - DATA AUDIT
// ==========================================================

const getMaggieAudit = async eventId => {

    const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : "";

    const response = await fetch(

        `${API_BASE_URL}/maggie/audit${query}`,

        {
            headers: {
                ...getAuthHeader()
            }
        }

    );


    return handleResponse(response);

};

const getMaggieAuditAllEvents = async () => {

    const response = await fetch(

        `${API_BASE_URL}/maggie/audit/all`,

        {
            headers: {
                ...getAuthHeader()
            }
        }

    );


    return handleResponse(response);

};


export {
    getAllSingers,
    getSingersOverview,
    getPairingSuggestions,
    decidePairing,
    bulkUpdateSingers,
    bulkDecidePairings,
    decideSolo,
    getFinalPairingList,
    saveFinalPairingList,
    getFinalListRollback,
    rollbackFinalPairingList,
    setFinalRowCompleted,
    getPairingChangeLog,
    addEventSinger,
    registerEventSingers,
    getSingersPerEvent,
    getFinanceByEvent,
    getEventAnalytics,
    getDashboardOverview,
    getMaggieAudit,
    getMaggieAuditAllEvents
};
