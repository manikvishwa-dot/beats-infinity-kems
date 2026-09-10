// ==========================================================
// BEATS INFINITY - JOURNEY SERVICE
// ==========================================================

import { API_V1_URL } from "../config/api";
import { getAuthHeader } from "./adminService";

const API_BASE_URL = `${API_V1_URL}/journey`;

const handleResponse = async response => {

    let data = {};

    try {
        data = await response.json();
    }
    catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data?.message || data?.error || "Request failed.");
    }

    return data;

};

const buildFormData = fields => {

    const formData = new FormData();

    Object.entries(fields).forEach(([key, value]) => {

        if (value !== undefined && value !== null) {
            formData.append(key, value);
        }

    });

    return formData;

};


// ==========================================================
// PUBLIC - most recent events for the Home page carousel
// ==========================================================

const getJourneyEvents = async () => {

    const response = await fetch(API_BASE_URL);

    return handleResponse(response);

};


// ==========================================================
// ADMIN - full list / create / update / delete
// ==========================================================

const getAllJourneyEvents = async () => {

    const response = await fetch(`${API_BASE_URL}/all`, {
        headers: { ...getAuthHeader() }
    });

    return handleResponse(response);

};

const createJourneyEvent = async fields => {

    const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: { ...getAuthHeader() },
        body: buildFormData(fields)
    });

    return handleResponse(response);

};

const updateJourneyEvent = async (id, fields) => {

    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: "PUT",
        headers: { ...getAuthHeader() },
        body: buildFormData(fields)
    });

    return handleResponse(response);

};

const deleteJourneyEvent = async id => {

    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() }
    });

    return handleResponse(response);

};


export {
    getJourneyEvents,
    getAllJourneyEvents,
    createJourneyEvent,
    updateJourneyEvent,
    deleteJourneyEvent
};
