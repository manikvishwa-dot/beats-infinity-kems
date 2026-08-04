const songRepository = require("../../repository/songRepository");

/**
 * Create Song
 */
exports.createSong = async (song) => {
    return await songRepository.createSong(song);
};

/**
 * Get All Songs
 */
exports.getAllSongs = async () => {
    return await songRepository.getAllSongs();
};

/**
 * Get Song By ID
 */
exports.getSongById = async (id) => {
    return await songRepository.getSongById(id);
};

/**
 * Update Song
 */
exports.updateSong = async (id, song) => {
    return await songRepository.updateSong(id, song);
};

/**
 * Delete Song
 */
exports.deleteSong = async (id) => {
    return await songRepository.deleteSong(id);
};

/**
 * Search Songs
 */
exports.searchSongs = async (searchText) => {
    return await songRepository.searchSongs(searchText);
};