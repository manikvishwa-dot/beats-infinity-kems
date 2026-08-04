const songService = require("../../services/v1/songService");

/**
 * Create Song
 */
exports.createSong = async (req, res) => {

    try {

        const newSong = await songService.createSong(req.body);

        return res.status(201).json({
            success: true,
            message: "Song created successfully.",
            data: newSong
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

/**
 * Get All Songs
 */
exports.getAllSongs = async (req, res) => {

    try {

        const songs = await songService.getAllSongs();

        return res.status(200).json({
            success: true,
            count: songs.length,
            data: songs
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

/**
 * Get Song By ID
 */
exports.getSongById = async (req, res) => {

    try {

        const song = await songService.getSongById(req.params.id);

        if (!song) {

            return res.status(404).json({
                success: false,
                message: "Song not found."
            });

        }

        return res.status(200).json({
            success: true,
            data: song
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

/**
 * Update Song
 */
exports.updateSong = async (req, res) => {

    try {

        const updatedSong = await songService.updateSong(
            req.params.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Song updated successfully.",
            data: updatedSong
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

/**
 * Delete Song
 */
exports.deleteSong = async (req, res) => {

    try {

        await songService.deleteSong(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Song deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

/**
 * Search Songs (Local Database)
 */
exports.searchSongs = async (req, res) => {

    try {

        const searchText = req.query.q;

        if (!searchText) {

            return res.status(400).json({
                success: false,
                message: "Please provide a search query using ?q="
            });

        }

        const songs = await songService.searchSongs(searchText);

        return res.status(200).json({
            success: true,
            count: songs.length,
            data: songs
        });

    } catch (error) {

        console.error("Search Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};