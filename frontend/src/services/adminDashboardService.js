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

const getSingersOverview = async () => {

    const response = await fetch(

        `${API_BASE_URL}/singers-overview`,

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

const getPairingSuggestions = async () => {

    const response = await fetch(

        `${API_BASE_URL}/pairings/suggestions`,

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

const bulkDecidePairings = async rows => {

    const response = await fetch(

        `${API_BASE_URL}/pairings/bulk-decide`,

        {
            method: "POST",
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
    getAllSingers,
    getSingersOverview,
    getPairingSuggestions,
    decidePairing,
    bulkUpdateSingers,
    bulkDecidePairings
};
