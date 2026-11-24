// ==========================================================
// FINAL LIST - EXCEL UPLOAD ANALYSIS
//
// Turns uploaded rows (male name | female name | song | movie)
// into a plan the admin reviews before anything happens:
//   - names that aren't registered yet  -> new singers
//   - two men / two women on one song   -> needs a "yes, they
//                                          sing it together"
//   - the same song + same two singers listed twice (once under
//     each singer)                      -> count once?
// Pure functions - no network, no React.
// ==========================================================

export const normalizeName = value =>
    String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

const isSoloWord = value => normalizeName(value) === "solo";

const clean = value => String(value ?? "").trim();

// Registered singer for a name: prefer one already in this event
// (two registrations can share a name)
const buildLookup = singers => {
    const map = new Map();
    singers.forEach(singer => {
        const key = normalizeName(singer.singer_name);
        const current = map.get(key);
        if (!current || (!current.in_event && singer.in_event)) {
            map.set(key, singer);
        }
    });
    return map;
};

// First pass: rows + who's missing
export const analyzeUpload = (parsedRows, singers) => {

    const lookup = buildLookup(singers);
    const problems = [];
    const missing = new Map();   // key -> { name, gender }

    const rows = parsedRows
        .filter(row => [row.male_singer_name, row.female_singer_name, row.song_title]
            .some(value => clean(value)))
        .map((row, index) => {
            const first = clean(row.male_singer_name);
            const secondRaw = clean(row.female_singer_name);
            const second = isSoloWord(secondRaw) ? "" : secondRaw;
            const title = clean(row.song_title);

            if (!first && !second) problems.push(`Row ${index + 1}: no singer.`);
            if (!title) problems.push(`Row ${index + 1}: song name is missing.`);

            return {
                line: index + 1,
                first,
                second,
                title,
                movie: clean(row.movie)
            };
        });

    // A missing name's gender: Male if it ever appears in the Male
    // column, otherwise Female. The admin can flip it.
    rows.forEach(row => {
        [[row.first, "Male"], [row.second, "Female"]].forEach(([name, column]) => {
            if (!name || lookup.has(normalizeName(name))) return;
            const key = normalizeName(name);
            const existing = missing.get(key);
            if (!existing) missing.set(key, { key, name, gender: column });
            else if (column === "Male") existing.gender = "Male";
        });
    });

    return { rows, problems, newSingers: [...missing.values()] };

};

// Second pass (re-run whenever the admin flips a gender):
// resolve every row to singers and find same-gender rows and
// duplicates. `genderOf(key)` gives a new singer's chosen gender.
export const resolveUpload = (rows, singers, newSingers) => {

    const lookup = buildLookup(singers);
    const newByKey = new Map(newSingers.map(s => [s.key, s]));

    const who = name => {
        if (!name) return null;
        const key = normalizeName(name);
        const existing = lookup.get(key);
        if (existing) return { key, name: existing.singer_name, id: existing.id, gender: existing.gender };
        const fresh = newByKey.get(key);
        return fresh ? { key, name: fresh.name, id: null, gender: fresh.gender } : null;
    };

    const resolved = rows.map(row => {
        const a = who(row.first);
        const b = who(row.second);
        const both = Boolean(a && b);
        const sameGender = both && normalizeName(a.gender) === normalizeName(b.gender);

        // Put each singer in their own column when genders differ
        // (fixes swapped columns); same-gender rows keep file order.
        let male = a;
        let female = b;
        if (both && !sameGender && normalizeName(a.gender) === "female") {
            male = b;
            female = a;
        }
        if (!both) {
            const only = a || b;
            male = only && normalizeName(only.gender) !== "female" ? only : null;
            female = only && normalizeName(only.gender) === "female" ? only : null;
        }

        return { ...row, male, female, sameGender, pairKey: [a?.key, b?.key].filter(Boolean).sort().join("|") };
    });

    // Same two singers + same song more than once
    const firstSeen = new Map();
    const duplicates = [];
    resolved.forEach((row, index) => {
        const key = `${row.pairKey}|${normalizeName(row.title)}`;
        if (!row.title || !row.pairKey) return;
        if (firstSeen.has(key)) duplicates.push({ index, of: firstSeen.get(key) });
        else firstSeen.set(key, index);
    });

    return { resolved, duplicates };

};
