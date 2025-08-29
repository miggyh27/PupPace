const {
    VITE_SPOTIFY_CLIENT_ID,
    VITE_THEDOGAPI_KEY
} = import.meta.env;

function getSpotifyToken() {
    const redirectUri = window.location.origin;
    const scope = 'user-read-private user-read-email playlist-read-private';
    
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${VITE_SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&show_dialog=true`;
    
    window.location.href = authUrl;
}

function extractTokenFromUrl() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
}

async function fetchDogBreeds() {
    const response = await fetch("https://api.thedogapi.com/v1/breeds", {
        headers: { 'x-api-key': VITE_THEDOGAPI_KEY }
    });

    if (!response.ok) {
        throw new Error(`Dog breed service unavailable: HTTP ${response.status}`);
    }

    return await response.json();
}

async function fetchCoordinatesForCity(city) {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);

    if (!response.ok) {
        throw new Error(`Geocoding service error: ${response.status}`);
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

async function fetchWeatherData(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m&timezone=auto&forecast_days=1`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Weather forecasting service unavailable: HTTP ${response.status}`);
    }

    return await response.json();
}

function mapPaceToTempo(pace) {
    const tempoRanges = {
        stroll: { min_tempo: 80, max_tempo: 110 },
        brisk:  { min_tempo: 115, max_tempo: 130 },
        jog:    { min_tempo: 135, max_tempo: 160 },
    };
    return tempoRanges[pace] || tempoRanges.brisk;
}

function mapWeatherToMusicParams(weathercode) {
    if ([0, 1].includes(weathercode)) {
        return { min_valence: 0.7, min_energy: 0.6 }; // Sunny
    }
    if ([2, 3].includes(weathercode)) {
        return { min_valence: 0.5, max_valence: 0.8 }; // Cloudy
    }
    if (weathercode >= 51 && weathercode <= 67) {
        return { max_valence: 0.4, max_energy: 0.5 }; // Rain
    }
    if (weathercode >= 71 && weathercode <= 86) {
        return { min_energy: 0.7 }; // Snow
    }
    if (weathercode >= 95) {
        return { min_energy: 0.8, min_tempo: 130 }; // Thunderstorm
    }
    return {};
}

async function fetchSpotifyRecommendations(token, pace, weathercode, breedTemperament) {
    const playlistMap = {
        'stroll': {
            'Playful': '37i9dQZF1DX5Vy6DFOcx00',
            'Intelligent': '37i9dQZF1DX7KNKjOK0o75',
            'Friendly': '37i9dQZF1DX5Vy6DFOcx00',
            'Confident': '37i9dQZF1DX5Vy6DFOcx00',
            'Calm': '37i9dQZF1DX7KNKjOK0o75',
            'Loyal': '37i9dQZF1DX5Vy6DFOcx00',
        },
        'brisk': {
            'Playful': '37i9dQZF1DXcBWIGoYBM5M',
            'Intelligent': '37i9dQZF1DX5Vy6DFOcx00',
            'Friendly': '37i9dQZF1DXcBWIGoYBM5M',
            'Confident': '37i9dQZF1DX5Ejj0ekUR0P',
            'Calm': '37i9dQZF1DX5Vy6DFOcx00',
            'Loyal': '37i9dQZF1DX5Vy6DFOcx00',
        },
        'jog': {
            'Playful': '37i9dQZF1DXcBWIGoYBM5M',
            'Intelligent': '37i9dQZF1DXcBWIGoYBM5M',
            'Friendly': '37i9dQZF1DXcBWIGoYBM5M',
            'Confident': '37i9dQZF1DXcBWIGoYBM5M',
            'Calm': '37i9dQZF1DXcBWIGoYBM5M',
            'Loyal': '37i9dQZF1DXcBWIGoYBM5M',
        }
    };

    const breedMatch = Object.keys(playlistMap[pace]).find(trait =>
        breedTemperament?.includes(trait)
    );
    const playlistId = breedMatch ? playlistMap[pace][breedMatch] : playlistMap[pace]['Friendly'];

    const playlistName = `PupPace: ${pace.charAt(0).toUpperCase() + pace.slice(1)} Walk`;
    return { playlistId, playlistName };
}

async function createSpotifyPlaylist(token, playlistData, playlistName) {
    if (!playlistData || !playlistData.playlistId) {
        throw new Error('Playlist data missing');
    }

    return {
        id: playlistData.playlistId,
        embedUrl: `https://open.spotify.com/embed/playlist/${playlistData.playlistId}?utm_source=generator`,
        name: playlistName,
        artist: 'Various Artists',
        track: 'Playlist'
    };
}

export {
    getSpotifyToken,
    extractTokenFromUrl,
    fetchDogBreeds,
    fetchCoordinatesForCity,
    fetchWeatherData,
    fetchSpotifyRecommendations,
    createSpotifyPlaylist
};
