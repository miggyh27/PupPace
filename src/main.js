import * as api from './api.js';
import * as ui from './ui.js';
import { scoreDay } from './scoring.js';

const { VITE_THEDOGAPI_KEY } = import.meta.env;

const PERSIST_KEY = 'puppace_state_v2';

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

// use the new scoring that considers breed differences
function processWeatherData(weatherData, selectedBreed = null) {
  const scored = scoreDay(weatherData, selectedBreed);
  
  return {
    benjiMeter: {
      score: scored.current.shapedScore,
      label: scoreLabel(scored.current.shapedScore),
      className: scoreClass(scored.current.shapedScore)
    },
    bestNext: scored.bestNext ? {
      time: scored.bestNext.timeLabel,
      temp: Math.round(((weatherData.hourly.temperature_2m[scored.bestNext.hourIndex]) * 9) / 5 + 32),
      precip: weatherData.hourly.precipitation_probability?.[scored.bestNext.hourIndex] ?? 0,
      wind: Math.round((weatherData.hourly.wind_speed_10m?.[scored.bestNext.hourIndex] ?? 0)),
      hourIndex: scored.bestNext.hourIndex,
      score: scored.bestNext.shapedScore,
      label: scoreLabel(scored.bestNext.shapedScore),
      className: scoreClass(scored.bestNext.shapedScore),
      reasons: scored.bestNext.reasons,
      suggest: scored.bestNext.suggest,
      adjustedScore: scored.bestNext.adjustedScore,
      timePreference: scored.bestNext.timePreference
    } : null,
    topRecommendations: scored.windows.map(w => ({
      startIndex: w.startIndex,
      time: `${w.startTime}–${w.endTime}`,
      score: w.best,
      label: w.label,
      className: scoreClass(w.best),
      avg: w.avgScore,
      length: w.length
    })),
    currentAndNext: scored.next12.map(r => ({
      time: r.timeLabel,
      temp: Math.round(((weatherData.hourly.temperature_2m[r.hourIndex]) * 9) / 5 + 32),
      precip: weatherData.hourly.precipitation_probability?.[r.hourIndex] ?? 0,
      wind: Math.round((weatherData.hourly.wind_speed_10m?.[r.hourIndex] ?? 0)),
      hourIndex: r.hourIndex,
      score: r.shapedScore,
      label: scoreLabel(r.shapedScore),
      className: scoreClass(r.shapedScore),
      reasons: r.reasons,
      suggest: r.suggest
    }))
  };
}

function scoreClass(s){ return s>=8 ? 'score-great' : s>=6 ? 'score-good' : 'score-poor'; }
function scoreLabel(s){ return s>=9 ? 'Perfect!' : s>=8 ? 'Great!' : s>=6 ? 'Good' : s>=4 ? 'Okay' : 'Not Ideal'; }





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

  // validate inputs
  if (!city || !breedName) {
    ui.displayError('Please enter a city and breed name.');
    return;
  }
  
  if (city.length > 100 || breedName.length > 100) {
    ui.displayError('City and breed names must be under 100 characters.');
    return;
  }
  
  if (!/^[a-zA-Z\s,.-]+$/.test(city) || !/^[a-zA-Z\s]+$/.test(breedName)) {
    ui.displayError('Please use only letters, spaces, and basic punctuation.');
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

export { processWeatherData };
