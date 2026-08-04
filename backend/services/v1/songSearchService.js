const axios = require("axios");

exports.searchSongs = async (query) => {

    const apiKey = process.env.YOUTUBE_API_KEY;

    const url = "https://www.googleapis.com/youtube/v3/search";

    const response = await axios.get(url, {

        params: {

            key: apiKey,

            part: "snippet",

            q: `${query} tamil song`,

            maxResults: 10,

            type: "video"

        }

    });

    return response.data.items.map(item => ({

        title: item.snippet.title,

        channel: item.snippet.channelTitle,

        thumbnail: item.snippet.thumbnails.medium.url,

        videoId: item.id.videoId,

        provider: "YouTube"

    }));

};