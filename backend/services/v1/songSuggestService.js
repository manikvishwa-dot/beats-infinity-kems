const axios = require("axios");
const { supabase } = require("../../config/supabase");

// ==========================================================
// BEATS INFINITY - SONG SUGGESTIONS + MOVIE LOOKUP
// ==========================================================
//
// suggestSongs("kadhalikkum")
//   -> song titles as the singer types. Sources, in order:
//      1. songs singers already picked (have movie names)
//      2. Google search suggestions (best coverage of Tamil
//         song names, cleaned of "lyrics", "ringtone", ...)
//
// findMovies("Kadhalikkum Pennin Kaigal")
//   -> movie names for a chosen song. Sources, in order:
//      1. songs singers already picked
//      2. Apple Music (iTunes Search API, India store)
//
// No API keys, no paid services. Results are cached in memory
// for a day to stay well inside the free sources' rate limits.
// ==========================================================

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;

const cache = new Map();

const cached = async (key, compute) => {

    const hit = cache.get(key);

    if (hit && hit.expiresAt > Date.now()) {
        return hit.value;
    }

    const value = await compute();

    if (cache.size >= CACHE_MAX) {
        cache.delete(cache.keys().next().value);
    }

    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });

    return value;

};


// ----------------------------------------------------------
// TEXT HELPERS
// ----------------------------------------------------------

// Words Google adds to song searches that aren't part of the
// song name. Removed only from the END of a suggestion.
const NOISE_WORDS = new Set([
    "lyrics", "lyric", "ringtone", "ringtones", "bgm", "song", "songs",
    "karaoke", "video", "videos", "status", "mp3", "download", "whatsapp",
    "cut", "cover", "tamil", "english", "in", "remix", "audio", "female",
    "male", "version", "spotify", "singer", "singers", "music", "director",
    "movie", "film", "name", "full", "hd", "4k", "8d", "slowed", "reverb",
    "lofi", "instrumental", "notes", "piano", "guitar", "chords", "meaning",
    "translation", "tune", "flute", "violin", "dj", "mashup", "reels",
    "shorts", "online", "free", "track", "original", "sad", "tamilwire",
    "masstamilan", "isaimini", "starmusiq", "youtube", "background",
    "theme", "ost", "tiktok", "edit"
]);

const stripNoise = (text) => {

    const words = String(text || "").trim().split(/\s+/);

    while (words.length > 1 && NOISE_WORDS.has(words[words.length - 1].toLowerCase())) {
        words.pop();
    }

    return words.join(" ");

};

const titleCase = (text) =>
    String(text || "")
        .toLowerCase()
        .replace(/(^|[\s(-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());

// Sound-alike key for Tamil transliterations:
// "Kaadhal" / "Kadhal" / "Kathal" and "Kaigal" / "Kaikal" all
// collapse to the same key.
const skeleton = (text) =>
    String(text || "")
        .toLowerCase()
        .replace(/\(.*?\)|\[.*?\]/g, " ")
        .replace(/[^a-z]/g, "")
        .replace(/[aeiouyh]/g, "")
        .replace(/[dt]/g, "t")
        .replace(/[gkcq]/g, "k")
        .replace(/[bp]/g, "p")
        .replace(/[zsj]/g, "s")
        .replace(/(.)\1+/g, "$1");

const levenshtein = (a, b) => {

    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {

        const current = [i];

        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }

        previous = current;

    }

    return previous[b.length];

};

// Do two song titles sound like the same song?
const titlesMatch = (a, b) => {

    const ka = skeleton(a);
    const kb = skeleton(b);

    if (!ka || !kb) return false;
    if (ka === kb) return true;

    const longer = Math.max(ka.length, kb.length);

    return levenshtein(ka, kb) / longer <= 0.2;

};

// "Kaadhalan (Original Motion Picture Soundtrack)" -> "Kaadhalan"
// "Song (From \"Movie\") - Single"                -> "Movie"
// Anything else (compilations like "Romantic Melody", indie EPs)
// isn't a movie -> "".
const cleanMovieName = (collectionName, trackName) => {

    const fromMatch =
        String(trackName || "").match(/\(From\s+["“](.+?)["”]\)/i) ||
        String(collectionName || "").match(/\(From\s*["“](.+?)["”]\)/i);

    if (fromMatch) {
        return fromMatch[1].trim();
    }

    if (!/soundtrack/i.test(String(collectionName || ""))) {
        return "";
    }

    const name = String(collectionName || "")
        .replace(/\s*\((Original\s+)?(Motion\s+Picture\s+)?(Original\s+)?Soundtrack\)\s*/i, " ")
        .replace(/\s*-\s*(EP|Single)\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();

    return name;

};


// ----------------------------------------------------------
// SOURCES
// ----------------------------------------------------------

const searchPastPicks = async (query) => {

    const { data, error } = await supabase
        .from("songs")
        .select("title,movie")
        .ilike("title", `%${query.replace(/[%_]/g, "")}%`)
        .limit(40);

    if (error) {
        console.warn("Song suggest - past picks:", error.message);
        return [];
    }

    return data || [];

};

const googleSuggest = (query) => cached(`g:${query.toLowerCase()}`, async () => {

    try {

        const response = await axios.get(
            "https://suggestqueries.google.com/complete/search",
            {
                params: { client: "firefox", hl: "en", q: query },
                timeout: 4000
            }
        );

        return Array.isArray(response.data?.[1]) ? response.data[1] : [];

    } catch (error) {

        console.warn("Song suggest - Google:", error.message);
        return [];

    }

});

const itunesSearch = (term) => cached(`i:${term.toLowerCase()}`, async () => {

    try {

        // Built by hand: Apple returns no results when spaces
        // are sent as "+", which is how axios encodes params.
        const response = await axios.get(
            "https://itunes.apple.com/search" +
                `?term=${encodeURIComponent(term)}` +
                "&media=music&entity=song&country=IN&limit=15",
            { timeout: 5000 }
        );

        return response.data?.results || [];

    } catch (error) {

        console.warn("Movie lookup - iTunes:", error.message);
        return [];

    }

});


// ----------------------------------------------------------
// PUBLIC
// ----------------------------------------------------------

// Returns [{ title, movie }] - movie is "" when not known yet.
const suggestSongs = async (rawQuery) => {

    const query = String(rawQuery || "").trim().slice(0, 80);

    if (query.length < 2) {
        return [];
    }

    const [pastPicks, googleRaw] = await Promise.all([
        searchPastPicks(query),
        googleSuggest(query)
    ]);

    const results = [];

    // Usable as a song name? Rejects YouTube-style video titles
    // ("Song | Actor | Composer", "4k Video Song", Tamil script),
    // which older picks saved from the YouTube search contain.
    const looksLikeSongName = (text) =>
        Boolean(text) &&
        !/[|#]/.test(text) &&
        !/[^\x20-\x7E]/.test(text) &&
        !/\b(video|live at|full movie|jukebox|lofi|whatsapp|status)\b/i.test(text) &&
        text.split(/\s+/).length <= 8;

    const add = (rawTitle, movie) => {

        // "kadhal neethana kadhal neethana song lyrics"
        //   -> "Kadhal Neethana"
        const stripped = stripNoise(rawTitle)
            .replace(/^(.+?)\s+\1$/i, "$1");

        if (!looksLikeSongName(stripped)) return;

        // What the singer typed is added last (see below)
        if (stripped.toLowerCase() === query.toLowerCase()) return;

        const title = titleCase(stripped);
        const cleanMovie = looksLikeSongName(movie) ? movie : "";

        const same = results.find((r) => titlesMatch(r.title, title));

        if (same) {
            // Same song - keep the fuller name
            // ("Kadhalikkum Aasai" -> "Kadhalikkum Aasai Illai")
            if (title.toLowerCase().startsWith(same.title.toLowerCase() + " ")) {
                same.title = title;
            }
            // Fill in the movie if this copy knows it
            if (!same.movie && cleanMovie) same.movie = cleanMovie;
            // Same title from a different movie is a different song
            if (!cleanMovie || !same.movie || same.movie === cleanMovie) return;
        }

        results.push({ title, movie: cleanMovie });

    };

    // Past picks first - they come with a movie
    pastPicks
        .filter((song) => song.title)
        .forEach((song) => add(song.title, String(song.movie || "").trim()));

    googleRaw.forEach((text) => add(text, ""));

    // Exactly what was typed, last - it may be the full song name
    // ("Vaseegara") even when Google only offers longer phrases.
    const typed = titleCase(query);

    if (looksLikeSongName(typed) && !results.some((r) => r.title.toLowerCase() === typed.toLowerCase())) {
        results.splice(7, results.length, { title: typed, movie: "" });
    }

    return results.slice(0, 8);

};

// Returns ["Movie A", "Movie B"] best first, [] when unknown.
const findMovies = async (rawTitle) => {

    const title = String(rawTitle || "").trim().slice(0, 120);

    if (title.length < 2) {
        return [];
    }

    const movies = [];

    const add = (movie) => {
        const clean = String(movie || "").trim();
        if (clean && !movies.some((m) => skeleton(m) === skeleton(clean))) {
            movies.push(clean);
        }
    };

    // 1. Songs singers already picked
    const pastPicks = await searchPastPicks(title.split(/\s+/)[0]);

    pastPicks
        .filter((song) => song.movie && titlesMatch(song.title, title))
        .forEach((song) => add(song.movie));

    // 2. Apple Music
    const tracks = await itunesSearch(title);

    tracks
        .filter((track) => titlesMatch(track.trackName, title))
        .forEach((track) => add(cleanMovieName(track.collectionName, track.trackName)));

    return movies.slice(0, 4);

};


module.exports = {
    suggestSongs,
    findMovies,
    // exported for tests
    stripNoise,
    titlesMatch,
    cleanMovieName
};
