// ==========================================================
// BEATS INFINITY - SINGER-FACING PAIRING SERVICE
// ==========================================================

import { API_V1_URL } from "../config/api";

const API_BASE_URL =
    `${API_V1_URL}/pairings`;


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
// GET MY PAIRING
// ==========================================================

const getMyPairing = async singerId => {

    const response = await fetch(

        `${API_BASE_URL}/my?singer_id=${encodeURIComponent(singerId)}`

    );


    return handleResponse(response);

};


export {
    getMyPairing
};
