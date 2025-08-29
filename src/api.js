// External API integrations for weather, music, and breed data

// Load API keys from environment
const {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    THEDOGAPI_KEY
} = import.meta.env;

// Authenticate with Spotify to get access token for API calls
async function getSpotifyToken() {
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Spotify auth failed: ${response.status} ${errorData.error || ''}`);
    }

    const data = await response.json();
    return data.access_token;
}

// Load dog breeds data from TheDogAPI
async function fetchDogBreeds() {
    const response = await fetch("https://api.thedogapi.com/v1/breeds", {
        headers: { 'x-api-key': THEDOGAPI_KEY }
    });

    if (!response.ok) {
        throw new Error(`Breed API error: ${response.status}`);
    }

    return await response.json();
}

// Convert city name to geographic coordinates using Open-Meteo geocoding
async function fetchCoordinatesForCity(city) {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);

    if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
        throw new Error(`Location "${city}" not found`);
    }

    return {
        latitude: data.results[0].latitude,
        longitude: data.results[0].longitude,
        name: data.results[0].name,
    };
}

// Fetch hourly weather forecast for walk planning
async function fetchWeatherData(latitude, longitude) {
    // Request specific weather parameters needed for walk safety analysis
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m&timezone=auto&forecast_days=1`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
    }

    return await response.json();
}

// Map walking pace to appropriate music tempo ranges
function mapPaceToTempo(pace) {
    // Tempo ranges calibrated for comfortable listening while walking
    const tempoRanges = {
        stroll: { min_tempo: 80, max_tempo: 110 },  // Relaxed, conversational pace
        brisk:  { min_tempo: 115, max_tempo: 130 }, // Moderate walking rhythm
        jog:    { min_tempo: 135, max_tempo: 160 }, // Energetic running cadence
    };
    return tempoRanges[pace] || tempoRanges.brisk; // Default to brisk if pace unknown
}

// Translate weather conditions into music mood parameters
function mapWeatherToMusicParams(weathercode) {
    // WMO weather codes: 0=clear, 1=mostly clear, 2-3=cloudy, 51-67=rain, 71-86=snow, 95+=thunder
    if ([0, 1].includes(weathercode)) {
        return { min_valence: 0.7, min_energy: 0.6 }; // Bright, uplifting for sunny weather
    }
    if ([2, 3].includes(weathercode)) {
        return { min_valence: 0.5, max_valence: 0.8 }; // Balanced mood for overcast
    }
    if (weathercode >= 51 && weathercode <= 67) {
        return { max_valence: 0.4, max_energy: 0.5 }; // Softer, more contemplative for rain
    }
    if (weathercode >= 71 && weathercode <= 86) {
        return { min_energy: 0.7 }; // More energetic to combat winter cold
    }
    if (weathercode >= 95) {
        return { min_energy: 0.8, min_tempo: 130 }; // High energy for stormy conditions
    }
    return {}; // Neutral settings for unusual weather codes
}

// Generate music recommendations based on walk conditions
async function fetchSpotifyRecommendations(token, pace, weathercode, breedTemperament) {
    const tempo = mapPaceToTempo(pace);
    const weatherParams = mapWeatherToMusicParams(weathercode);

    // Match dog temperament traits to music genres for personalized recommendations
    const temperamentToGenres = {
        'Playful': 'pop,funk',           // Energetic, fun vibes
        'Intelligent': 'ambient,classical', // Thoughtful, sophisticated
        'Friendly': 'summer,happy',      // Warm, approachable
        'Confident': 'rock,electronic',  // Bold, assertive
        'Calm': 'acoustic,chill',        // Relaxed, peaceful
        'Loyal': 'singer-songwriter',    // Authentic, heartfelt
    };

    // Find matching temperament or use default genre mix
    const matchingTemperament = Object.keys(temperamentToGenres).find(key =>
        breedTemperament.includes(key)
    );
    const seedGenres = matchingTemperament ? temperamentToGenres[matchingTemperament] : 'pop,rock,chill';

    // Build Spotify API request with all our parameters
    const params = new URLSearchParams({
        limit: 20,
        seed_genres: seedGenres,
        ...tempo,
        ...weatherParams
    });

    const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
        headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Spotify recommendations failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    if (!data.tracks || data.tracks.length === 0) {
        throw new Error('No tracks match your current walking conditions');
    }

    const trackUris = data.tracks.map(track => track.uri);
    const playlistName = `PupPace: ${pace.charAt(0).toUpperCase() + pace.slice(1)} Walk`;

    return { trackUris, playlistName };
}

// Prepare Spotify embed for the first recommended track
async function createSpotifyPlaylist(token, trackUris, playlistName) {
    try {
        // Extract track ID from Spotify URI format (spotify:track:xxxxx)
        const firstTrackId = trackUris[0].split(':')[2];

        // Fetch track metadata to ensure it exists and is playable
        const response = await fetch(`https://api.spotify.com/v1/tracks/${firstTrackId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) {
            throw new Error(`Track not available: ${response.status}`);
        }

        const trackData = await response.json();

        // Return embed-ready data structure
        return {
            id: trackData.id,
            embedUrl: `https://open.spotify.com/embed/track/${trackData.id}?utm_source=generator`,
            name: playlistName,
        };
    } catch(error) {
        console.error('Spotify embed creation failed:', error);
        throw new Error('Unable to prepare music player');
    }
}

export {
    getSpotifyToken,
    fetchDogBreeds,
    fetchCoordinatesForCity,
    fetchWeatherData,
    fetchSpotifyRecommendations,
    createSpotifyPlaylist
};
