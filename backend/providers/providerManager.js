const config = require("../config/providers");

const appleProvider = require("./appleProvider");

// Future
// const spotifyProvider = require("./spotifyProvider");
// const youtubeProvider = require("./youtubeProvider");

exports.search = async (query) => {

    let songs = [];

    if (config.APPLE) {

        try {

            const appleSongs = await appleProvider.search(query);

            songs.push(...appleSongs);

        } catch (err) {

            console.error("Apple Provider Error");

            console.error(err.message);

        }

    }

    /*
    Future

    if(config.SPOTIFY){

    }

    if(config.YOUTUBE){

    }

    */

    return songs;

};