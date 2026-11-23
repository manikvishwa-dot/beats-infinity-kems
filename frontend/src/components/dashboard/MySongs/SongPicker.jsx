import { useEffect, useRef, useState } from "react";

import { API_V1_URL } from "../../../config/api";

// ==========================================================
// BEATS INFINITY - SONG PICKER
// ==========================================================
//
//  Song:  [ kadhalikkum              ]  <- suggestions as you type
//  Movie: [ Kaadhalan                ]  <- filled in automatically
//  ( Duet ) ( Solo )                    <- Solo for male singers only
//                      [ Add to my songs ]
//
// Song suggestions: /song-search/suggest (past picks + Google).
// Movie lookup:     /song-search/movie   (past picks + Apple Music).
// If no movie is found, the singer types it.
// ==========================================================

const SUGGEST_DELAY_MS = 300;

const getJson = async (url) => {

    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
        throw new Error(data.message || "Request failed.");
    }

    return data;

};


function SongPicker({
    isMale,
    duetCount,
    duetLimit,
    hasSolo,
    disabled,
    onAdd
}) {

    const [title, setTitle] = useState("");
    const [movie, setMovie] = useState("");
    const [kind, setKind] = useState("duet");

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const [movieOptions, setMovieOptions] = useState([]);
    const [lookingUpMovie, setLookingUpMovie] = useState(false);
    const [movieAutoFilled, setMovieAutoFilled] = useState(false);

    const [error, setError] = useState("");

    // Skip the suggestion fetch right after a suggestion is picked
    const skipNextSuggestRef = useRef(false);

    // Ignore out-of-order responses
    const suggestRequestRef = useRef(0);
    const movieRequestRef = useRef(0);

    const movieInputRef = useRef(null);

    const duetsFull = duetCount >= duetLimit;
    const soloAllowed = isMale && !hasSolo;

    // Keep the type valid as the limits change
    const effectiveKind =
        kind === "solo" && !soloAllowed
            ? "duet"
            : kind === "duet" && duetsFull && soloAllowed
                ? "solo"
                : kind;


    // ------------------------------------------------------
    // SONG SUGGESTIONS WHILE TYPING
    // ------------------------------------------------------

    useEffect(() => {

        if (skipNextSuggestRef.current) {
            skipNextSuggestRef.current = false;
            return undefined;
        }

        const query = title.trim();

        if (query.length < 2) {
            return undefined;
        }

        const requestId = ++suggestRequestRef.current;

        const timer = setTimeout(async () => {

            setLoadingSuggestions(true);

            try {

                const data = await getJson(
                    `${API_V1_URL}/song-search/suggest?q=${encodeURIComponent(query)}`
                );

                if (requestId === suggestRequestRef.current) {
                    setSuggestions(data.suggestions || []);
                    setActiveIndex(-1);
                }

            }
            catch {

                if (requestId === suggestRequestRef.current) {
                    setSuggestions([]);
                }

            }
            finally {

                if (requestId === suggestRequestRef.current) {
                    setLoadingSuggestions(false);
                }

            }

        }, SUGGEST_DELAY_MS);

        return () => clearTimeout(timer);

    }, [title]);


    // ------------------------------------------------------
    // MOVIE LOOKUP FOR A CHOSEN SONG
    // ------------------------------------------------------

    const lookUpMovie = async (songTitle, knownMovie) => {

        const requestId = ++movieRequestRef.current;

        setMovieOptions([]);

        if (knownMovie) {
            setMovie(knownMovie);
            setMovieAutoFilled(true);
        }
        else {
            setMovie("");
            setMovieAutoFilled(false);
        }

        setLookingUpMovie(true);

        try {

            const data = await getJson(
                `${API_V1_URL}/song-search/movie?title=${encodeURIComponent(songTitle)}`
            );

            if (requestId !== movieRequestRef.current) {
                return;
            }

            const movies = data.movies || [];

            setMovieOptions(movies);

            if (!knownMovie && movies.length > 0) {
                setMovie(movies[0]);
                setMovieAutoFilled(true);
            }

            if (!knownMovie && movies.length === 0) {
                movieInputRef.current?.focus();
            }

        }
        catch {

            // Lookup is a convenience - the singer can still type it

        }
        finally {

            if (requestId === movieRequestRef.current) {
                setLookingUpMovie(false);
            }

        }

    };

    const pickSuggestion = (suggestion) => {

        skipNextSuggestRef.current = true;

        setTitle(suggestion.title);
        setSuggestions([]);
        setShowSuggestions(false);
        setError("");

        lookUpMovie(suggestion.title, suggestion.movie);

    };


    // ------------------------------------------------------
    // INPUT HANDLERS
    // ------------------------------------------------------

    const handleTitleChange = (event) => {

        const value = event.target.value;

        setTitle(value);
        setShowSuggestions(true);
        setError("");

        if (value.trim().length < 2) {
            setSuggestions([]);
        }

        // A new song name invalidates an auto-filled movie
        if (movieAutoFilled) {
            setMovie("");
            setMovieOptions([]);
            setMovieAutoFilled(false);
        }

    };

    const handleTitleKeyDown = (event) => {

        const open = showSuggestions && suggestions.length > 0;

        if (event.key === "ArrowDown" && open) {
            event.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        }
        else if (event.key === "ArrowUp" && open) {
            event.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        }
        else if (event.key === "Enter") {
            event.preventDefault();
            if (open && activeIndex >= 0) {
                pickSuggestion(suggestions[activeIndex]);
            }
            else if (title.trim()) {
                // Typed a song that isn't in the list - use it as is
                pickSuggestion({ title: title.trim(), movie: "" });
            }
        }
        else if (event.key === "Escape") {
            setShowSuggestions(false);
        }

    };

    const handleTitleBlur = () => {

        // Let a click on a suggestion land first
        setTimeout(() => {

            setShowSuggestions(false);

            // Typed a full name without picking - still look up its movie
            if (title.trim().length >= 2 && !movie && !lookingUpMovie && movieOptions.length === 0) {
                lookUpMovie(title.trim(), "");
            }

        }, 150);

    };


    // ------------------------------------------------------
    // ADD
    // ------------------------------------------------------

    const handleAdd = () => {

        const cleanTitle = title.trim().replace(/\s+/g, " ");
        const cleanMovie = movie.trim().replace(/\s+/g, " ");

        if (!cleanTitle) {
            setError("Enter the song name.");
            return;
        }

        if (!cleanMovie) {
            setError("Enter the movie name.");
            movieInputRef.current?.focus();
            return;
        }

        const problem = onAdd({
            title: cleanTitle,
            movie: cleanMovie,
            kind: effectiveKind
        });

        if (problem) {
            setError(problem);
            return;
        }

        setTitle("");
        setMovie("");
        setSuggestions([]);
        setMovieOptions([]);
        setMovieAutoFilled(false);
        setError("");

    };

    const nothingLeftToAdd = duetsFull && !soloAllowed;

    if (nothingLeftToAdd) {
        return null;
    }


    // ------------------------------------------------------
    // RENDER
    // ------------------------------------------------------

    const listOpen =
        showSuggestions &&
        title.trim().length >= 2 &&
        (suggestions.length > 0 || loadingSuggestions);

    return (

        <div className="song-picker">

            <label className="song-picker-label" htmlFor="song-picker-title">
                Song
            </label>

            <div className="song-picker-field">

                <input
                    id="song-picker-title"
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    onKeyDown={handleTitleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={handleTitleBlur}
                    placeholder="Start typing a song name..."
                    className="song-search-input"
                    autoComplete="off"
                    disabled={disabled}
                    role="combobox"
                    aria-expanded={listOpen}
                    aria-controls="song-picker-suggestions"
                />

                {listOpen && (

                    <ul
                        id="song-picker-suggestions"
                        className="song-picker-suggestions"
                        role="listbox"
                    >

                        {loadingSuggestions && suggestions.length === 0 && (
                            <li className="song-picker-suggestion muted">Searching...</li>
                        )}

                        {suggestions.map((suggestion, index) => (

                            <li
                                key={`${suggestion.title}|${suggestion.movie}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                className={`song-picker-suggestion ${index === activeIndex ? "active" : ""}`}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    pickSuggestion(suggestion);
                                }}
                            >

                                <span className="song-picker-suggestion-title">
                                    {suggestion.title}
                                </span>

                                {suggestion.movie && (
                                    <span className="song-picker-suggestion-movie">
                                        {suggestion.movie}
                                    </span>
                                )}

                            </li>

                        ))}

                    </ul>

                )}

            </div>


            <label className="song-picker-label" htmlFor="song-picker-movie">
                Movie
                {lookingUpMovie && (
                    <span className="song-picker-hint"> finding movie...</span>
                )}
                {!lookingUpMovie && movieAutoFilled && movie && (
                    <span className="song-picker-hint ok"> ✓ filled in - change it if it's wrong</span>
                )}
            </label>

            <input
                id="song-picker-movie"
                ref={movieInputRef}
                type="text"
                value={movie}
                onChange={(event) => {
                    setMovie(event.target.value);
                    setMovieAutoFilled(false);
                    setError("");
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        handleAdd();
                    }
                }}
                placeholder={
                    lookingUpMovie
                        ? "Finding the movie..."
                        : "Movie name"
                }
                className="song-search-input"
                autoComplete="off"
                disabled={disabled}
            />

            {movieOptions.length > 1 && (

                <div className="song-picker-movie-options">

                    <span>Other movies with this song:</span>

                    {movieOptions
                        .filter((option) => option !== movie)
                        .map((option) => (
                            <button
                                type="button"
                                key={option}
                                className="song-picker-chip"
                                onClick={() => {
                                    setMovie(option);
                                    setMovieAutoFilled(true);
                                }}
                            >
                                {option}
                            </button>
                        ))}

                </div>

            )}


            {isMale && (

                <div className="song-picker-kind" role="radiogroup" aria-label="Song type">

                    <button
                        type="button"
                        role="radio"
                        aria-checked={effectiveKind === "duet"}
                        className={`song-picker-kind-btn ${effectiveKind === "duet" ? "selected" : ""}`}
                        onClick={() => setKind("duet")}
                        disabled={disabled || duetsFull}
                    >
                        Duet {duetsFull ? "(all 6 added)" : ""}
                    </button>

                    <button
                        type="button"
                        role="radio"
                        aria-checked={effectiveKind === "solo"}
                        className={`song-picker-kind-btn ${effectiveKind === "solo" ? "selected" : ""}`}
                        onClick={() => setKind("solo")}
                        disabled={disabled || !soloAllowed}
                    >
                        Solo (optional) {hasSolo ? "- added" : ""}
                    </button>

                </div>

            )}


            {error && (
                <div className="no-songs-compact error">{error}</div>
            )}

            <button
                type="button"
                className="proceed-payment-btn song-picker-add"
                onClick={handleAdd}
                disabled={disabled || !title.trim()}
            >
                {effectiveKind === "solo" ? "Add as my solo" : "Add to my duet songs"}
            </button>

        </div>

    );

}


export default SongPicker;
