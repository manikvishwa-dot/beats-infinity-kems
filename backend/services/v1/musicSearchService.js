const providerManager = require("../../providers/providerManager");
const songRepository = require("../../repository/songRepository");

exports.search = async (query) => {

    // 1. Search local repository first
    const localSongs = await songRepository.search(query);

    if (localSongs.length > 0) {

        console.log("✅ Songs found in Repository");

        return localSongs;

    }

    console.log("🌐 Searching External Providers...");

    // 2. Search external providers
    const providerSongs = await providerManager.search(query);

    // 3. Save into repository
    for (const song of providerSongs) {

        await songRepository.save(song);

    }

    return providerSongs;

};