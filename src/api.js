// api calls and music stuff
const {
  VITE_SPOTIFY_CLIENT_ID,
  VITE_THEDOGAPI_KEY,
  VITE_SERVER_ORIGIN
} = import.meta.env;

// config for retries, timeouts, and caching
const API_CONFIG = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 200,
  CACHE_TTL: {
    BREEDS: 1000 * 60 * 60 * 24 * 7,
    GEO: 1000 * 60 * 60 * 24 * 30,
    WEATHER: 1000 * 60 * 15
  },
  TIMEOUT: 10000,
  MAX_INPUT_LENGTH: 100
};

// localStorage wrapper with expiry
const LSC = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { v, exp } = JSON.parse(raw);
      if (exp && Date.now() > exp) { 
        localStorage.removeItem(key); 
        return null; 
      }
      return v;
    } catch (error) {
      console.warn(`Cache read error for ${key}:`, error);
      return null;
    }
  },
  set(key, v, ttlMs = API_CONFIG.CACHE_TTL.WEATHER) {
    try { 
      localStorage.setItem(key, JSON.stringify({ v, exp: Date.now() + ttlMs })); 
    } catch (error) {
      console.warn(`Cache write error for ${key}:`, error);
    }
  }
};

// retry with exponential backoff
async function retryWithBackoff(fn, attempts = API_CONFIG.RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      const delay = API_CONFIG.RETRY_DELAY * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// basic input sanitization
function validateInput(input, maxLength = API_CONFIG.MAX_INPUT_LENGTH) {
  if (!input || typeof input !== 'string') return false;
  if (input.length > maxLength) return false;
  if (!/^[a-zA-Z\s,.-]+$/.test(input)) return false;
  return true;
}

// fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// spotify oauth - not used yet but keeping it
function getSpotifyToken() {
  const redirectUri = window.location.origin;
  const scope = 'user-read-private user-read-email';
  const authUrl =
    `https://accounts.spotify.com/authorize?client_id=${VITE_SPOTIFY_CLIENT_ID}` +
    `&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}&show_dialog=true`;
  window.location.href = authUrl;
}

function extractTokenFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

// get all dog breeds with  error handling
async function fetchDogBreeds() {
  const cached = LSC.get('dog_breeds_v1');
  if (cached) return cached;

  return retryWithBackoff(async () => {
    const res = await fetchWithTimeout('https://api.thedogapi.com/v1/breeds', {
      headers: VITE_THEDOGAPI_KEY ? { 'x-api-key': VITE_THEDOGAPI_KEY } : {}
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Dog breed service unavailable: HTTP ${res.status} - ${errorText}`);
    }
    
    const json = await res.json();
    LSC.set('dog_breeds_v1', json, API_CONFIG.CACHE_TTL.BREEDS);
    return json;
  });
}

async function fetchCoordinatesForCity(city) {
  if (!validateInput(city)) {
    throw new Error('Invalid city name provided');
  }

  const key = `geo_${city.toLowerCase()}`;
  const cached = LSC.get(key);
  if (cached) return cached;

  // strip state if provided
  const query = city.split(',')[0].trim();

  return retryWithBackoff(async () => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const res = await fetchWithTimeout(url);
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Geocoding service error: ${res.status} - ${errorText}`);
    }
    
    const data = await res.json();
    if (!data.results?.length) {
      throw new Error(`Location "${city}" not found`);
    }

    const out = {
      latitude: data.results[0].latitude,
      longitude: data.results[0].longitude,
      name: `${data.results[0].name}${data.results[0].admin1 ? ', ' + data.results[0].admin1 : ''}`
    };
    LSC.set(key, out, API_CONFIG.CACHE_TTL.GEO);
    return out;
  });
}

// get weather forecast with all the data we need
async function fetchWeatherData(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || 
      isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Invalid coordinates provided');
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    forecast_days: '1',
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'uv_index',
      'precipitation_probability',
      'weathercode',
      'wind_speed_10m',
      'wind_gusts_10m',
      'cloudcover'
    ].join(','),
    daily: ['sunrise','sunset','uv_index_max'].join(',')
  }).toString();

  return retryWithBackoff(async () => {
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Weather forecasting service unavailable: HTTP ${res.status} - ${errorText}`);
    }
    return res.json();
  });
}

function mapPaceToTempo(pace) {
  const tempoMap = {
    quick:  { min_tempo: 140, max_tempo: 160, target_tempo: 150 },
    stroll: { min_tempo: 82, max_tempo: 108, target_tempo: 95 },
    brisk:  { min_tempo: 112, max_tempo: 128, target_tempo: 120 },
    jog:    { min_tempo: 132, max_tempo: 160, target_tempo: 142 }
  };
  
  return tempoMap[pace] || tempoMap.brisk;
}

// Pick music mood based on weather
function mapWeatherToMusicParams(weathercode) {
  const weatherMoodMap = {
    clear: [0, 1],
    cloudy: [2, 3],
    rain: [51, 52, 53, 54, 55, 56, 57, 61, 62, 63, 64, 65, 66, 67, 80, 81, 82],
    snow: [71, 72, 73, 74, 75, 76, 77, 85, 86],
    storm: [95, 96, 99]
  };

  if (weatherMoodMap.clear.includes(weathercode)) {
    return { min_valence: 0.65, min_energy: 0.55 };
  }
  if (weatherMoodMap.cloudy.includes(weathercode)) {
    return { min_valence: 0.45, max_valence: 0.75, min_energy: 0.4 };
  }
  if (weatherMoodMap.rain.includes(weathercode)) {
    return { max_valence: 0.45, max_energy: 0.6 };
  }
  if (weatherMoodMap.snow.includes(weathercode)) {
    return { min_energy: 0.6, max_valence: 0.7 };
  }
  if (weatherMoodMap.storm.includes(weathercode)) {
    return { min_energy: 0.75, min_tempo: 128 };
  }
  return {};
}

// Pick music genres based on dog personality
function temperamentToGenreSeeds(temperament = '') {
  const t = temperament.toLowerCase();
  const seeds = new Set(['pop']);
  
  const genreRules = [
    { pattern: /playful|active|energetic/, genres: ['dance', 'electronic'] },
    { pattern: /calm|gentle|laid[- ]?back/, genres: ['chill', 'jazz'] },
    { pattern: /intelligent|smart|trainable/, genres: ['indie'] },
    { pattern: /confident|bold/, genres: ['rock'] },
    { pattern: /friendly|affectionate|sociable/, genres: ['r-n-b'] }
  ];

  genreRules.forEach(rule => {
    if (rule.pattern.test(t)) {
      rule.genres.forEach(genre => seeds.add(genre));
    }
  });

  return Array.from(seeds).slice(0, 3);
}

async function fetchSpotifyRecommendations(pace, weathercode, breedTemperament) {
  if (!pace || !weathercode) {
    throw new Error('Missing required parameters for music recommendations');
  }

  const server = VITE_SERVER_ORIGIN || 'http://localhost:8787';

  const tempo = mapPaceToTempo(pace);
  const mood = mapWeatherToMusicParams(weathercode);
  const seeds = temperamentToGenreSeeds(breedTemperament);
  
  const params = new URLSearchParams({
    seed_genres: seeds.join(','),
    limit: '20',
    target_tempo: String(tempo.target_tempo),
  });

  // Add mood parameters
  Object.entries(mood).forEach(([k, v]) => params.set(k, String(v)));
  
  if (!params.has('min_tempo')) params.set('min_tempo', String(tempo.min_tempo));
  if (!params.has('max_tempo')) params.set('max_tempo', String(tempo.max_tempo));

  const url = `${server}/api/spotify/recommendations?${params.toString()}`;
  
  return retryWithBackoff(async () => {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Spotify recommendations unavailable: HTTP ${res.status} - ${errorText}`);
    }
    const data = await res.json();

    return {
      tracks: data.tracks || [],
      playlistName: `PupPace • ${pace[0].toUpperCase() + pace.slice(1)} • ${seeds.join(' · ')}`
    };
  });
}

// Backup playlists if our recommendations don't work
const PLAYLIST_FALLBACK = {
  stroll: '37i9dQZF1DX4E3UdUs7fUx',
  brisk:  '37i9dQZF1DXcBWIGoYBM5M',
  jog:    '37i9dQZF1DX76Wlfdnj7AP'
};

async function createSpotifyPlaylist(_token, payload, playlistName) {
  if (payload?.tracks?.length) {
    const first = payload.tracks[0];
    return {
      id: first.id,
      embedUrl: `https://open.spotify.com/embed/track/${first.id}?utm_source=pupcast`,
      name: playlistName,
      tracks: payload.tracks
    };
  }

  // Otherwise use one of our backup playlists
  if (payload?.playlistId) {
    return {
      id: payload.playlistId,
      embedUrl: `https://open.spotify.com/embed/playlist/${payload.playlistId}?utm_source=pupcast`,
      name: playlistName,
      tracks: []
    };
  }

  return { id: null, embedUrl: '', name: playlistName, tracks: [] };
}

export {
  getSpotifyToken,
  extractTokenFromUrl,
  fetchDogBreeds,
  fetchCoordinatesForCity,
  fetchWeatherData,
  fetchSpotifyRecommendations,
  createSpotifyPlaylist,
  mapPaceToTempo,
  mapWeatherToMusicParams,
  PLAYLIST_FALLBACK
};
