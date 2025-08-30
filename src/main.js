import * as api from './api.js';
import * as ui from './ui.js';

const { VITE_THEDOGAPI_KEY } = import.meta.env;

const PERSIST_KEY = 'pupcast_state_v2';

const state = {
  spotifyAccessToken: null,
  allBreeds: [],
  currentWeather: null,
  selectedBreed: null,
  petName: null,
  location: null,
  isWalkActive: false,
  walkStartTime: null,
  timerInterval: null,
  currentPace: 'brisk',
  walkDuration: 0,
  // not saved to localStorage
  lastWalkWindowIndex: null
};

function saveState() {
  try {
    const snapshot = {
      selectedBreed: state.selectedBreed && {
        id: state.selectedBreed.id,
        name: state.selectedBreed.name,
        temperament: state.selectedBreed.temperament || ''
      },
      petName: state.petName,
      location: state.location,
      currentPace: state.currentPace
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
  } catch {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw);
    if (snap?.selectedBreed) state.selectedBreed = snap.selectedBreed;
    if (snap?.petName) state.petName = snap.petName;
    if (snap?.location) state.location = snap.location;
    if (snap?.currentPace) state.currentPace = snap.currentPace;
  } catch {}
}

function switchView(viewName) {
  const ids = ['planning-view', 'active-walk-view', 'summary-view'];
  ids.forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById(viewName).classList.remove('hidden');

  const firstFocusable = document.getElementById(viewName).querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) firstFocusable.focus({ preventScroll: true });
}

// Figure out the best walking times by scoring each hour and finding good windows
function processWeatherData(weatherData, selectedBreed = null) {
  const hourly = weatherData.hourly;
  const now = Date.now();

  // Find where we are in the hourly data (Open-Meteo uses local time)
  let currentIndex = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    if (new Date(hourly.time[i]).getTime() >= now) { currentIndex = i; break; }
  }

  const allHourScores = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const ts = new Date(hourly.time[i]);
    const hour = ts.getHours();

    const tempC = hourly.temperature_2m[i];
    const tempF = Math.round((tempC * 9) / 5 + 32);
    const rh = hourly.relative_humidity_2m?.[i] ?? null;
    const uv = hourly.uv_index?.[i] ?? null;
    const precip = hourly.precipitation_probability?.[i] ?? 0;
    const wind = Math.round(hourly.wind_speed_10m?.[i] ?? 0);
    const wxCode = hourly.weathercode?.[i] ?? 0;

    const scoreObj = calculateBenjiScore({
      tempF, rh, windMph: wind, precip, hour, uvIndex: uv, weathercode: wxCode,
      breed: selectedBreed
    });

    allHourScores.push({
      time: ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      temp: tempF,
      precip,
      wind,
      hourIndex: i,
      score: scoreObj.score,
      label: scoreObj.label,
      className: scoreObj.className
    });
  }

  // Find stretches of good weather (score 6+) and rank them by length and quality
  const windows = [];
  let start = null, sum = 0, count = 0;
  for (let i = 0; i < allHourScores.length; i++) {
    const s = allHourScores[i].score;
    if (s >= 6) {
      if (start === null) start = i;
      sum += s; count += 1;
    } else if (start !== null) {
      windows.push(makeWindow(allHourScores, start, i - 1, sum / count));
      start = null; sum = 0; count = 0;
    }
  }
  if (start !== null) windows.push(makeWindow(allHourScores, start, allHourScores.length - 1, sum / count));
  const rankedWindows = windows
    .map(w => ({ ...w, goodness: w.avgScore * (1 + (w.length - 1) * 0.12) }))
    .sort((a, b) => b.goodness - a.goodness);

  const benjiMeter = allHourScores[currentIndex] || allHourScores[0];
  const topRecommendations = rankedWindows.slice(0, 4);
  const currentAndNext = allHourScores.slice(currentIndex, currentIndex + 12);

  return { benjiMeter, topRecommendations, currentAndNext };
}

function makeWindow(scores, i0, i1, avgScore) {
  return {
    startIndex: i0,
    endIndex: i1,
    length: i1 - i0 + 1,
    avgScore: Math.round(avgScore * 10) / 10,
    startTime: scores[i0].time,
    endTime: scores[i1].time,
    best: Math.max(...scores.slice(i0, i1 + 1).map(s => s.score)),
    label: avgScore >= 8 ? 'Great' : avgScore >= 6.5 ? 'Good' : 'Okay'
  };
}

// Weather safety score for dogs - looks at temp, humidity, wind, UV, and breed traits
function calculateBenjiScore({ tempF, rh, windMph, precip, hour, uvIndex, weathercode, breed }) {
  let score = 10;

  // Time of day matters - late night/early morning is harder to see
  if (hour >= 22 || hour <= 5) score -= 3.5;
  else if (hour >= 6 && hour <= 8) score -= 0.5;
  else if (hour >= 18 && hour <= 21) score += 0.5;

  // Calculate what it actually feels like outside
  const heatIdx = rh != null ? heatIndexF(tempF, rh) : tempF;
  const feelsLikeHot = Math.max(tempF, heatIdx);
  const windCh = windChillF(tempF, windMph);
  const feelsLikeCold = Math.min(tempF, windCh);

  if (feelsLikeHot > 100 || feelsLikeCold < 5) score -= 6;
  else if (feelsLikeHot > 90 || feelsLikeCold < 15) score -= 4;
  else if (feelsLikeHot > 80 || feelsLikeCold < 32) score -= 2;
  else if (feelsLikeCold >= 45 && feelsLikeHot <= 80) score += 1.5;

  // Humidity and UV
  if (rh != null) {
    if (rh > 80 && tempF >= 75) score -= 1.5;
    else if (rh > 65 && tempF >= 80) score -= 1.0;
  }
  if (uvIndex != null) {
    if (uvIndex >= 8) score -= 1.5;
    else if (uvIndex >= 6) score -= 0.5;
  }

  // Precipitation and wind
  if (precip > 70) score -= 3;
  else if (precip > 50) score -= 2;
  else if (precip > 30) score -= 1;

  if (windMph > 30) score -= 2.5;
  else if (windMph > 20) score -= 1.5;
  else if (windMph > 12) score -= 0.5;

  // Adjust for different dog types - rough guesses based on breed names
  const name = (breed?.name || '').toLowerCase();
  const isBrachy = /(bulldog|pug|boxer|pekingese|shi[h]? tzu|mastiff)/.test(name);
  const snowDog = /(husky|malamute|samoyed|bernese|akita)/.test(name);
  const tiny = /(chihuahua|pomeranian|toy|miniature)/.test(name);

  if (isBrachy && tempF >= 75) score -= 1.0;
  if (snowDog && tempF >= 85) score -= 1.0;
  if (snowDog && tempF <= 35) score += 0.5;
  if (tiny && tempF <= 40) score -= 0.5;

  // Thunderstorms
  if (weathercode >= 95) score -= 2;

  // Keep score between 0-10 and pick a label
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  let label = 'Not Ideal', className = 'score-poor';
  if (score >= 8.5) { label = 'Perfect!'; className = 'score-great'; }
  else if (score >= 7) { label = 'Great!'; className = 'score-great'; }
  else if (score >= 5.5) { label = 'Good'; className = 'score-good'; }
  else if (score >= 3.5) { label = 'Okay'; className = 'score-good'; }

  return { score: Math.round(score), label, className };
}

// NOAA heat index formula (temperature in °F)
function heatIndexF(T, R) {
  const c1=-42.379,c2=2.04901523,c3=10.14333127,c4=-0.22475541,c5=-6.83783e-3,c6=-5.481717e-2,c7=1.22874e-3,c8=8.5282e-4,c9=-1.99e-6;
  return c1+c2*T+c3*R+c4*T*R+c5*T*T+c6*R*R+c7*T*T*R+c8*T*R*R+c9*T*T*R*R;
}
function windChillF(T, V) {
  if (T > 50 || V < 3) return T;
  return 35.74 + 0.6215*T - 35.75*Math.pow(V,0.16) + 0.4275*T*Math.pow(V,0.16);
}

function getDistinctRandom(items, n, exceptId) {
  const pool = items.filter(b => b.id !== exceptId);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}

function getTrivia() {
  if (!state.allBreeds.length) return;
  const selectedBreed = state.allBreeds[Math.floor(Math.random() * state.allBreeds.length)];
  const correct = selectedBreed.temperament?.split(',')[0]?.trim() || `is known for a distinct personality.`;
  const distractors = getDistinctRandom(state.allBreeds.filter(b=>b.temperament), 2, selectedBreed.id)
    .map(b => b.temperament.split(',')[0].trim())
    .filter(Boolean);
  const all = [correct, ...distractors].slice(0,3).sort(()=>0.5 - Math.random());
  ui.renderTrivia(`The ${selectedBreed.name}…`, all, correct);
}

async function getBreedPhotoGame() {
  if (!state.allBreeds.length) return;
  const selectedBreed = state.allBreeds[Math.floor(Math.random() * state.allBreeds.length)];
  try {
    const resp = await fetch(`https://api.thedogapi.com/v1/images/search?breed_ids=${selectedBreed.id}&limit=1`, {
      headers: VITE_THEDOGAPI_KEY ? { 'x-api-key': VITE_THEDOGAPI_KEY } : {}
    });
    if (!resp.ok) throw new Error('Breed image fetch failed');
    const data = await resp.json();
    const url = data?.[0]?.url;
    if (!url) throw new Error('No image');

    const fakeNames = getDistinctRandom(state.allBreeds, 3, selectedBreed.id).map(b=>b.name);
    const options = [selectedBreed.name, ...fakeNames].sort(()=>0.5 - Math.random());
    ui.renderBreedPhotoGame(url, 'What breed is this dog?', options, selectedBreed.name);
  } catch (e) {
    ui.displayError("Can't load breed photo right now.");
  }
}

async function handlePlanWalk() {
  const city = document.getElementById('city-input').value.trim();
  const petName = document.getElementById('pet-name-input').value.trim();
  const breedName = document.getElementById('breed-input').value.trim();

  if (!city || !breedName) {
    ui.displayError('Please enter a city and breed name.');
    return;
  }
  ui.showLoader();

  try {
    const breedMatch = state.allBreeds.find(b => b.name.toLowerCase() === breedName.toLowerCase())
      || state.allBreeds.find(b => b.name.toLowerCase().includes(breedName.toLowerCase()));
    if (!breedMatch) throw new Error(`Breed "${breedName}" not found. Try a different name.`);

    state.selectedBreed = breedMatch;
    state.petName = petName || 'your pup';
    const coords = await api.fetchCoordinatesForCity(city);
    state.location = coords.name;

    // Get detailed weather data including humidity, UV, etc
    state.currentWeather = await api.fetchWeatherData(coords.latitude, coords.longitude);

    const walkWindows = processWeatherData(state.currentWeather, state.selectedBreed);
    ui.hideLoader();
    ui.renderWalkTimes(walkWindows, state.location);
    saveState();
  } catch (e) {
    ui.displayError(e.message);
  }
}

async function handleStartWalk(timeIndex) {
  state.isWalkActive = true;
  state.currentPace = state.currentPace || 'brisk';
  state.walkStartTime = Date.now();
  state.lastWalkWindowIndex = Number(timeIndex);
  ui.updateActivePaceButton(state.currentPace);

  state.timerInterval = setInterval(() => {
    state.walkDuration = Math.floor((Date.now() - state.walkStartTime) / 1000);
    ui.updateTimerDisplay(state.walkDuration);
  }, 1000);

  switchView('active-walk-view');
  await updatePlaylist();
}

async function handlePaceChange(newPace) {
  if (state.currentPace === newPace) return;
  state.currentPace = newPace;
  ui.updateActivePaceButton(newPace);
  saveState();
  await updatePlaylist();
}

function handleFinishWalk() {
  state.isWalkActive = false;
  clearInterval(state.timerInterval);
  ui.renderSummary(state.walkDuration, state.petName);
  switchView('summary-view');
}

function handleNewWalk() {
  state.walkDuration = 0;
  ui.updateTimerDisplay(0);
  switchView('planning-view');
  document.getElementById('results-section').classList.add('hidden');
}

// Get music recommendations - try our server first, fall back to curated playlists
async function updatePlaylist() {
  ui.renderPlaylist({});

  try {
    // Figure out which hour's weather to use for music
    const now = Date.now();
    const times = state.currentWeather?.hourly?.time || [];
    let idx = 0;
    for (let i = 0; i < times.length; i++) {
      if (new Date(times[i]).getTime() >= now) { idx = i; break; }
    }
    const useIdx = Number.isFinite(state.lastWalkWindowIndex) ? state.lastWalkWindowIndex : idx;
    const wxCode = state.currentWeather?.hourly?.weathercode?.[useIdx] ?? 1;

    const rec = await api.fetchSpotifyRecommendations(
      state.currentPace,
      wxCode,
      state.selectedBreed?.temperament || ''
    );

    const playlist = await api.createSpotifyPlaylist(null, rec, rec.playlistName);
    ui.renderPlaylist(playlist);
  } catch (e) {
    const id = api.PLAYLIST_FALLBACK[state.currentPace] || api.PLAYLIST_FALLBACK.brisk;
    const playlist = await api.createSpotifyPlaylist(null, { playlistId: id }, `PupPace • ${state.currentPace}`);
    ui.renderPlaylist(playlist);
  }
}

// Set up the app - load data, connect events, restore previous session
async function initialize() {
  loadState();
  setupThemeToggle();
  try {
    const breeds = await api.fetchDogBreeds();
    state.allBreeds = breeds.filter(b => !!b.name);
    ui.setupBreedAutocomplete(state.allBreeds, state.selectedBreed?.name || '');
    if (state.location) document.getElementById('city-input').value = state.location;
    if (state.petName) document.getElementById('pet-name-input').value = state.petName;
  } catch (e) {
    ui.displayError(e.message);
  }
}

function setupEventListeners() {
  document.getElementById('plan-walk-btn').addEventListener('click', handlePlanWalk);

  document.getElementById('walk-times-container').addEventListener('click', (event) => {
    const btn = event.target.closest('.start-walk-btn');
    if (btn) handleStartWalk(btn.dataset.timeIndex);
  });

  document.getElementById('pace-controls').addEventListener('click', (event) => {
    const btn = event.target.closest('.pace-btn');
    if (btn) handlePaceChange(btn.dataset.pace);
  });

  document.getElementById('finish-walk-btn').addEventListener('click', handleFinishWalk);
  document.getElementById('start-new-walk-btn').addEventListener('click', handleNewWalk);

  document.getElementById('trivia-btn').addEventListener('click', () => {
    getTrivia();
    document.getElementById('trivia-modal').classList.remove('hidden');
  });

  document.getElementById('photo-game-btn').addEventListener('click', () => {
    getBreedPhotoGame();
    document.getElementById('trivia-modal').classList.remove('hidden');
  });

  document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('trivia-modal').classList.add('hidden');
  });

  document.getElementById('next-trivia-btn').addEventListener('click', () => {
    if (document.querySelector('.breed-image-container')) getBreedPhotoGame();
    else getTrivia();
  });
}

// Handle dark/light mode switching and save the choice
function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('puppace_theme') || 'dark';

  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('puppace_theme', newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initialize();
});

export { processWeatherData, calculateBenjiScore };
