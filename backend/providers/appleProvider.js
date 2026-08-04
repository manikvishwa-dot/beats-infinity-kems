const axios = require("axios");
const normalizeAppleSong = require("../utils/normalizeAppleSong");

console.log("normalizeAppleSong:");
console.log(normalizeAppleSong);

exports.search = async (query) => {

    const url =
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=5`;

    console.log("Searching URL:");
    console.log(url);

    const response = await axios.get(url);

    console.log("Result Count:", response.data.resultCount);

    if (!response.data.results) {
        return [];
    }

    const songs = [];

    for (const song of response.data.results) {

        console.log("----------------------");
        console.log(song.trackName);

        const normalizedSong = normalizeAppleSong.normalize(song);

        console.log(normalizedSong);

        songs.push(normalizedSong);

    }

    return songs;

};