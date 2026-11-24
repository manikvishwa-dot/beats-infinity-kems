// ==========================================================
// BIRTHDAYS - "is today their birthday?" in India time.
//
// 2000-01-01 is the placeholder date given to singers whose
// real date of birth isn't known yet - never a birthday.
// Born on 29 Feb -> celebrated on 28 Feb in non-leap years.
// ==========================================================

const PLACEHOLDER_DOB = "2000-01-01";

// Today's date in India as { year, month, day }
const todayInIndia = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(now);

    const get = type => Number(parts.find(part => part.type === type).value);

    return { year: get("year"), month: get("month"), day: get("day") };
};

const isLeapYear = year =>
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const isBirthdayToday = (dateOfBirth, now = new Date()) => {

    const dob = String(dateOfBirth || "").slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob === PLACEHOLDER_DOB) {
        return false;
    }

    let month = Number(dob.slice(5, 7));
    let day = Number(dob.slice(8, 10));
    const today = todayInIndia(now);

    if (month === 2 && day === 29 && !isLeapYear(today.year)) {
        day = 28;
    }

    return month === today.month && day === today.day;

};

module.exports = {
    PLACEHOLDER_DOB,
    todayInIndia,
    isBirthdayToday
};
