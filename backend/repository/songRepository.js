const { supabase } = require("../config/supabase");

/**
 * Create Song
 */
exports.createSong = async (song) => {

    console.log("========================================");
    console.log("🎵 Repository - Create Song");
    console.log(song);
    console.log("========================================");

    const payload = {
        title: song.title,
        movie: song.movie,
        album: song.album,
        music_director: song.musicDirector,
        language: song.language,
        year: song.year,
        duration: song.duration,
        thumbnail: song.thumbnail,
        provider: song.provider,
        karaoke_available: song.karaokeAvailable,
        difficulty: song.difficulty,
        male_singers: song.maleSingers,
        female_singers: song.femaleSingers,
        theme_tags: song.themeTags,
        is_duet: song.isDuet,
        performance_count: 0,
        reserved_male: false,
        reserved_female: false
    };

    const { data, error } = await supabase
        .from("songs")
        .insert(payload)
        .select()
        .single();

    if (error) {

        console.error("Supabase Insert Error:");
        console.error(error);

        throw new Error(error.message);

    }

    console.log("Inserted Song:");
    console.log(data);

    return data;

};

/**
 * Get All Songs
 */
exports.getAllSongs = async () => {

    console.log("========================================");
    console.log("📖 Repository - Get All Songs");
    console.log("Reading from Supabase...");
    console.log("========================================");

    const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("title", { ascending: true });

    if (error) {

        console.error("Supabase Read Error:");
        console.error(error);

        throw new Error(error.message);

    }

    console.log("========================================");
    console.log("Songs Retrieved:");
    console.log(data);
    console.log("Total Songs:", data.length);
    console.log("========================================");

    return data;

};

/**
 * Get Song By ID
 */
exports.getSongById = async (id) => {

    console.log("========================================");
    console.log("📖 Repository - Get Song By ID");
    console.log("Song ID:", id);
    console.log("========================================");

    const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {

        if (error.code === "PGRST116") {
            return null;
        }

        console.error(error);
        throw new Error(error.message);

    }

    console.log("Song Found:");
    console.log(data);

    return data;

};

/**
 * Update Song
 */
exports.updateSong = async (id, song) => {

    const payload = {
        title: song.title,
        movie: song.movie,
        album: song.album,
        music_director: song.musicDirector,
        language: song.language,
        year: song.year,
        duration: song.duration,
        thumbnail: song.thumbnail,
        provider: song.provider,
        karaoke_available: song.karaokeAvailable,
        difficulty: song.difficulty,
        male_singers: song.maleSingers,
        female_singers: song.femaleSingers,
        theme_tags: song.themeTags,
        is_duet: song.isDuet
    };

    const { data, error } = await supabase
        .from("songs")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error(error);
        throw new Error(error.message);
    }

    return data;

};

/**
 * Delete Song
 */
exports.deleteSong = async (id) => {

    const { error } = await supabase
        .from("songs")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        throw new Error(error.message);
    }

    return true;

};
/**
 * Search Songs
 */
exports.searchSongs = async (searchText) => {

    const { data, error } = await supabase
        .from("songs")
        .select("*")
        .or(
            `title.ilike.%${searchText}%,` +
            `movie.ilike.%${searchText}%,` +
            `album.ilike.%${searchText}%,` +
            `music_director.ilike.%${searchText}%,` +
            `language.ilike.%${searchText}%`
        )
        .order("title", { ascending: true });

    if (error) {

        console.error(error);
        throw new Error(error.message);

    }

    return data;

};