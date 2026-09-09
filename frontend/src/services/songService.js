// ==========================================================
// BEATS INFINITY - SONG CATALOG SERVICE
// ==========================================================

import { API_V1_URL } from "../config/api";
import { getAuthHeader } from "./adminService";

const API_BASE_URL =
    `${API_V1_URL}/songs`;

const SEARCH_URL =
    `${API_V1_URL}/song-search`;


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
// GET ALL SONGS
// ==========================================================

const getSongs = async () => {

    const response = await fetch(
        API_BASE_URL,
        {
            headers: {
                ...getAuthHeader()
            }
        }
    );


    return handleResponse(response);

};


// ==========================================================
// GET SONG BY ID
// ==========================================================

const getSongById = async songId => {

    const response = await fetch(
        `${API_BASE_URL}/${songId}`,
        {
            headers: {
                ...getAuthHeader()
            }
        }
    );

    return handleResponse(response);

};


// ==========================================================
// CREATE SONG
// ==========================================================

const createSong = async songData => {

    const response = await fetch(

        API_BASE_URL,

        {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },

            body: JSON.stringify(songData)

        }

    );


    return handleResponse(response);

};


// ==========================================================
// UPDATE SONG
// ==========================================================

const updateSong = async (songId, songData) => {

    const response = await fetch(

        `${API_BASE_URL}/${songId}`,

        {

            method: "PUT",

            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },

            body: JSON.stringify(songData)

        }

    );


    return handleResponse(response);

};


// ==========================================================
// DELETE SONG
// ==========================================================

const deleteSong = async songId => {

    const response = await fetch(

        `${API_BASE_URL}/${songId}`,

        {

            method: "DELETE",

            headers: {
                ...getAuthHeader()
            }

        }

    );


    return handleResponse(response);

};


// ==========================================================
// SEARCH SONG CATALOG (YouTube-backed, same as singer search)
// ==========================================================

const searchSongCatalog = async query => {

    const response = await fetch(
        `${SEARCH_URL}?q=${encodeURIComponent(query)}`
    );

    const data = await handleResponse(response);

    return data.songs || data.results || data.data || [];

};


// ==========================================================
// BULK UPSERT SONGS (Excel import)
// ==========================================================

const bulkUpsertSongs = async rows => {

    const response = await fetch(

        `${API_BASE_URL}/bulk`,

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
    getSongs,
    getSongById,
    createSong,
    updateSong,
    deleteSong,
    bulkUpsertSongs,
    searchSongCatalog
};
