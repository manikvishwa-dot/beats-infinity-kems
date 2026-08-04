const Song = require("../models/Song");

function normalize(appleSong) {

    return new Song({

        id: appleSong.trackId,

        title: appleSong.trackName,

        movie: appleSong.collectionName,

        album: appleSong.collectionName,

        musicDirector: appleSong.artistName,

        singers: [appleSong.artistName],

        language: "",

        duration: appleSong.trackTimeMillis,

        thumbnail: appleSong.artworkUrl100,

        provider: "Apple Music",

        releaseYear: appleSong.releaseDate
            ? appleSong.releaseDate.substring(0, 4)
            : ""

    });

}

module.exports = {
    normalize
};