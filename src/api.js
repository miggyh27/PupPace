// Functions for talking to external APIs and handling music
const {
  VITE_SPOTIFY_CLIENT_ID,
  VITE_THEDOGAPI_KEY,
  VITE_SERVER_ORIGIN // e.g. http://localhost:8787
} = import.meta.env;

// Simple cache to avoid hitting APIs too much
const LSC = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { v, exp } = JSON.parse(raw);
      if (exp && Date.now() > exp) { localStorage.removeItem(key); return null; }
      return v;
    } catch { return null; }
  },
  set(key, v, ttlMs = 1000 * 60 * 60 * 24) {
    try { localStorage.setItem(key, JSON.stringify({ v, exp: Date.now() + ttlMs })); } catch {}
  }
};

// OAuth stuff for later - not used right now but keeping it around
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

// Get list of dog breeds
async function fetchDogBreeds() {
  const cached = LSC.get('dog_breeds_v1');
  if (cached) return cached;

  const res = await fetch('https://api.thedogapi.com/v1/breeds', {
    headers: VITE_THEDOGAPI_KEY ? { 'x-api-key': VITE_THEDOGAPI_KEY } : {}
  });
  if (!res.ok) throw new Error(`Dog breed service unavailable: HTTP ${res.status}`);
  const json = await res.json();
  LSC.set('dog_breeds_v1', json, 1000 * 60 * 60 * 24 * 7);
  return json;
}

// Convert city name to coordinates using Open-Meteo
async function fetchCoordinatesForCity(city) {
  const key = `geo_${city.toLowerCase()}`;
  const cached = LSC.get(key);
  if (cached) return cached;

  // Handle inputs like "Chicago, Illinois" by just using the city part
  const query = city.split(',')[0].trim();

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding service error: ${res.status}`);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Location "${city}" not found`);

  const out = {
    latitude: data.results[0].latitude,
    longitude: data.results[0].longitude,
    name: `${data.results[0].name}${data.results[0].admin1 ? ', ' + data.results[0].admin1 : ''}`
  };
  LSC.set(key, out, 1000 * 60 * 60 * 24 * 30);
  return out;
}

// Get hourly weather forecast with all the data we need for scoring
async function fetchWeatherData(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    forecast_days: '1',
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'uv_index',
      'precipitation_probability',
      'weathercode',
      'wind_speed_10m'
    ].join(',')
  }).toString();

  // Try a few times if it fails
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url.toString());
    if (res.ok) return res.json();
    await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
  }
  throw new Error('Weather forecasting service unavailable');
}

// Convert walking pace to music tempo
function mapPaceToTempo(pace) {
  return ({
    stroll: { min_tempo: 82, max_tempo: 108, target_tempo: 95 },
    brisk:  { min_tempo: 112, max_tempo: 128, target_tempo: 120 },
    jog:    { min_tempo: 132, max_tempo: 160, target_tempo: 142 }
  }[pace] || { min_tempo: 112, max_tempo: 128, target_tempo: 120 });
}
// Pick music mood based on weather
function mapWeatherToMusicParams(weathercode) {
  if ([0,1].includes(weathercode)) return { min_valence: 0.65, min_energy: 0.55 };
  if ([2,3].includes(weathercode)) return { min_valence: 0.45, max_valence: 0.75, min_energy: 0.4 };
  if ((weathercode >= 51 && weathercode <= 67) || (weathercode >= 80 && weathercode <= 82)) return { max_valence: 0.45, max_energy: 0.6 };
  if (weathercode >= 71 && weathercode <= 86) return { min_energy: 0.6, max_valence: 0.7 };
  if (weathercode >= 95) return { min_energy: 0.75, min_tempo: 128 };
  return {};
}
// Pick music genres based on dog personality
function temperamentToGenreSeeds(temperament = '') {
  const t = temperament.toLowerCase();
  const seeds = new Set(['pop']);
  if (/playful|active|energetic/.test(t)) seeds.add('dance'), seeds.add('electronic');
  if (/calm|gentle|laid[- ]?back/.test(t)) seeds.add('chill'), seeds.add('jazz');
  if (/intelligent|smart|trainable/.test(t)) seeds.add('indie');
  if (/confident|bold/.test(t)) seeds.add('rock');
  if (/friendly|affectionate|sociable/.test(t)) seeds.add('r-n-b');
  return Array.from(seeds).slice(0, 3);
}

// Get music recommendations from our server (keeps secrets safe)
async function fetchSpotifyRecommendations(pace, weathercode, breedTemperament) {
  const server = VITE_SERVER_ORIGIN || 'http://localhost:8787';

  const tempo = mapPaceToTempo(pace);
  const mood = mapWeatherToMusicParams(weathercode);
  const seeds = temperamentToGenreSeeds(breedTemperament);
  const params = new URLSearchParams({
    seed_genres: seeds.join(','),
    limit: '20',
    target_tempo: String(tempo.target_tempo),
  });

  for (const [k, v] of Object.entries(mood)) params.set(k, String(v));
  if (!params.has('min_tempo')) params.set('min_tempo', String(tempo.min_tempo));
  if (!params.has('max_tempo')) params.set('max_tempo', String(tempo.max_tempo));

  const url = `${server}/api/spotify/recommendations?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Spotify recs unavailable');
  const data = await res.json();

  return {
    tracks: data.tracks || [],
    playlistName: `PupPace • ${pace[0].toUpperCase() + pace.slice(1)} • ${seeds.join(' · ')}`
  };
}

// Backup playlists if our recommendations don't work
const PLAYLIST_FALLBACK = {
  stroll: '37i9dQZF1DX4E3UdUs7fUx',
  brisk:  '37i9dQZF1DXcBWIGoYBM5M',
  jog:    '37i9dQZF1DX76Wlfdnj7AP'
};

async function createSpotifyPlaylist(_token, payload, playlistName) {
  // If we got tracks back, show the first one and a list
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
