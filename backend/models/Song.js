class Song {

    constructor({

        id = null,

        title = "",

        movie = "",

        album = "",

        musicDirector = "",

        singers = [],

        language = "",

        duration = null,

        thumbnail = "",

        provider = "",

        releaseYear = ""

    } = {}) {

        this.id = id;

        this.title = title;

        this.movie = movie;

        this.album = album;

        this.musicDirector = musicDirector;

        this.singers = singers;

        this.language = language;

        this.duration = duration;

        this.thumbnail = thumbnail;

        this.provider = provider;

        this.releaseYear = releaseYear;

    }

}


module.exports = Song;