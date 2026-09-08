// ==========================================================
// BEATS INFINITY - EVENT SERVICE
// ==========================================================

import { API_V1_URL } from "../config/api";
import { getAuthHeader } from "./adminService";

const API_BASE_URL =
    `${API_V1_URL}/events`;


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
// PUBLIC - ACTIVE EVENT
// ==========================================================

const getActiveEvent = async () => {

    const response = await fetch(`${API_BASE_URL}/active`);

    return handleResponse(response);

};


// ==========================================================
// ADMIN - LIST ALL EVENTS
// ==========================================================

const getEvents = async () => {

    const response = await fetch(API_BASE_URL, {
        headers: { ...getAuthHeader() }
    });

    return handleResponse(response);

};


// ==========================================================
// ADMIN - CREATE / UPDATE (multipart, optional banner file)
// ==========================================================

const buildFormData = fields => {

    const formData = new FormData();

    Object.entries(fields).forEach(([key, value]) => {

        if (value !== undefined && value !== null) {

            formData.append(key, value);

        }

    });

    return formData;

};

const createEvent = async fields => {

    const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: { ...getAuthHeader() },
        body: buildFormData(fields)
    });

    return handleResponse(response);

};

const updateEvent = async (eventId, fields) => {

    const response = await fetch(`${API_BASE_URL}/${eventId}`, {
        method: "PUT",
        headers: { ...getAuthHeader() },
        body: buildFormData(fields)
    });

    return handleResponse(response);

};


// ==========================================================
// ADMIN - ACTIVATE / DELETE
// ==========================================================

const activateEvent = async eventId => {

    const response = await fetch(`${API_BASE_URL}/${eventId}/activate`, {
        method: "PUT",
        headers: { ...getAuthHeader() }
    });

    return handleResponse(response);

};

const deleteEvent = async eventId => {

    const response = await fetch(`${API_BASE_URL}/${eventId}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() }
    });

    return handleResponse(response);

};


// ==========================================================
// SUPER ADMIN - FINANCE
// ==========================================================

const getFinanceSummary = async eventId => {

    const response = await fetch(`${API_BASE_URL}/${eventId}/finance`, {
        headers: { ...getAuthHeader() }
    });

    return handleResponse(response);

};

const createExpense = async (eventId, { description, amount, category }) => {

    const response = await fetch(`${API_BASE_URL}/${eventId}/expenses`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeader()
        },
        body: JSON.stringify({ description, amount, category })
    });

    return handleResponse(response);

};

const deleteExpense = async (eventId, expenseId) => {

    const response = await fetch(`${API_BASE_URL}/${eventId}/expenses/${expenseId}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() }
    });

    return handleResponse(response);

};


export {
    getActiveEvent,
    getEvents,
    createEvent,
    updateEvent,
    activateEvent,
    deleteEvent,
    getFinanceSummary,
    createExpense,
    deleteExpense
};
