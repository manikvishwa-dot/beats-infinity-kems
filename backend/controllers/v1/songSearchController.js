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