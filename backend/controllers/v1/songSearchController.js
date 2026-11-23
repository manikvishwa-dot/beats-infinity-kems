const songSearchService = require("../../services/v1/songSearchService");

exports.searchSongs = async (req, res) => {

    try {

        const query = req.query.q;

        if (!query) {

            return res.status(400).json({
                success: false,
                message: "Please provide search text."
            });

        }

        const results = await songSearchService.searchSongs(query);

        return res.status(200).json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ==========================================================
// SONG NAME SUGGESTIONS
//
// GET /api/v1/song-search/suggest?q=kadhalikkum
// -> { success, suggestions: [{ title, movie }] }
// ==========================================================

const songSuggestService = require("../../services/v1/songSuggestService");

exports.suggestSongs = async (req, res) => {

    try {

        const suggestions =
            await songSuggestService.suggestSongs(req.query.q);

        return res.status(200).json({ success: true, suggestions });

    } catch (error) {

        console.error("Song suggest error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load song suggestions."
        });

    }

};


// ==========================================================
// MOVIE LOOKUP
//
// GET /api/v1/song-search/movie?title=Kadhalikkum Pennin Kaigal
// -> { success, movies: ["Kaadhalan"] }
// ==========================================================

exports.findMovies = async (req, res) => {

    try {

        const movies =
            await songSuggestService.findMovies(req.query.title);

        return res.status(200).json({ success: true, movies });

    } catch (error) {

        console.error("Movie lookup error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to look up the movie."
        });

    }

};
