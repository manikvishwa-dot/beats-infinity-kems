const musicSearchService = require("../../services/v1/musicSearchService");

exports.searchSongs = async (req, res) => {
    try {

        const query = (req.query.q || "").trim();

        if (!query) {
            return res.status(400).json({
                success: false,
                version: "v1",
                message: "Search query is required.",
                timestamp: new Date().toISOString(),
                data: []
            });
        }

        const songs = await musicSearchService.search(query);

        return res.status(200).json({
            success: true,
            version: "v1",
            message: "Songs retrieved successfully.",
            timestamp: new Date().toISOString(),
            query,
            count: songs.length,
            data: songs
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            version: "v1",
            message: error.message,
            timestamp: new Date().toISOString(),
            data: []
        });

    }
};