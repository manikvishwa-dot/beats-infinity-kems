// ==========================================================
// BEATS INFINITY - DATE OF BIRTH PICKER (Day / Month / Year)
// ==========================================================
//
// Three dropdowns instead of <input type="date">:
//   - iPhone Safari shows an empty date input as a blank strip
//     with no hint, so singers couldn't see where to enter it
//   - Android's calendar makes picking 1985 a long scroll
//
// value / onChange use "YYYY-MM-DD"; onChange("") until all
// three parts are chosen.
// ==========================================================

import { useState } from "react";

import "./DobSelect.css";

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const pad = (n) => String(n).padStart(2, "0");

const daysIn = (year, month) =>
    year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;

const splitValue = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match
        ? { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) }
        : { year: "", month: "", day: "" };
};


function DobSelect({ value, onChange, disabled = false, idPrefix = "dob" }) {

    const [parts, setParts] = useState(() => splitValue(value));

    const thisYear = new Date().getFullYear();
    const years = [];
    for (let y = thisYear - 10; y >= 1930; y--) years.push(y);

    const update = (field, next) => {

        const merged = { ...parts, [field]: next };

        // 31 Feb -> 28/29 Feb when month/year changes
        const maxDay = daysIn(merged.year, merged.month);
        if (merged.day && Number(merged.day) > maxDay) {
            merged.day = String(maxDay);
        }

        setParts(merged);

        onChange(
            merged.year && merged.month && merged.day
                ? `${merged.year}-${pad(merged.month)}-${pad(merged.day)}`
                : ""
        );

    };

    const dayCount = daysIn(parts.year, parts.month);

    return (

        <div className="dob-select">

            <select
                id={`${idPrefix}-day`}
                aria-label="Day"
                value={parts.day}
                onChange={(e) => update("day", e.target.value)}
                disabled={disabled}
            >
                <option value="">Day</option>
                {Array.from({ length: dayCount }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                ))}
            </select>

            <select
                id={`${idPrefix}-month`}
                aria-label="Month"
                value={parts.month}
                onChange={(e) => update("month", e.target.value)}
                disabled={disabled}
            >
                <option value="">Month</option>
                {MONTHS.map((name, i) => (
                    <option key={name} value={String(i + 1)}>{name}</option>
                ))}
            </select>

            <select
                id={`${idPrefix}-year`}
                aria-label="Year"
                value={parts.year}
                onChange={(e) => update("year", e.target.value)}
                disabled={disabled}
            >
                <option value="">Year</option>
                {years.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                ))}
            </select>

        </div>

    );

}

export default DobSelect;
