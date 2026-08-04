class Song {

    constructor(data) {

        this.id = data.id || "";

        this.title = data.title || "";

        this.movie = data.movie || "";

        this.album = data.album || "";

        this.musicDirector = data.musicDirector || "";

        this.singers = data.singers || [];

        this.language = data.language || "";

        this.duration = data.duration || 0;

        this.thumbnail = data.thumbnail || "";

        this.provider = data.provider || "";

        this.releaseYear = data.releaseYear || "";

        // Beats Infinity Information
        this.beatsInfinity = {

            maleReserved: false,

            femaleReserved: false,

            reservedByMale: null,

            reservedByFemale: null,

            suggestedPair: [],

            difficulty: null,

            performanceCount: 0,

            karaokeAvailable: false

        };

    }

}

module.exports = Song;