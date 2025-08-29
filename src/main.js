// Main app controller
import * as api from './api.js';
import * as ui from './ui.js';

// App state
const state = {
    spotifyAccessToken: null,
    allBreeds: [],
    currentWeather: null,
    selectedBreed: null,
    location: null,
    isWalkActive: false,
    walkStartTime: null,
    timerInterval: null,
    currentPace: 'brisk',
    walkDuration: 0,
};

// Switch between app views
function switchView(viewName) {
    document.getElementById('planning-view').classList.add('hidden');
    document.getElementById('active-walk-view').classList.add('hidden');
    document.getElementById('summary-view').classList.add('hidden');
    document.getElementById(viewName).classList.remove('hidden');
}

// Process weather data for walk times
function processWeatherData(weatherData) {
    const now = new Date();
    const currentHour = now.getHours();
    const hourly = weatherData.hourly;

    const currentIndex = hourly.time.findIndex(t =>
        new Date(t).getHours() === currentHour);

    const benjiMeter = calculateBenjiScore(
        hourly.temperature_2m[currentIndex],
        hourly.precipitation_probability[currentIndex],
        hourly.windspeed_10m[currentIndex]
    );

    const recommendations = [];
    for (let i = currentIndex; i < currentIndex + 12 && i < hourly.time.length; i++) {
        const score = calculateBenjiScore(
            hourly.temperature_2m[i],
            hourly.precipitation_probability[i],
            hourly.windspeed_10m[i]
        );

        if (score.score >= 7) {
            recommendations.push({
                time: new Date(hourly.time[i]).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                }),
                temp: Math.round(hourly.temperature_2m[i] * 9/5 + 32),
                precip: hourly.precipitation_probability[i],
                hourIndex: i,
            });
        }
    }

    return {
        benjiMeter,
        recommendations: recommendations.slice(0, 4)
    };
}

// Calculate walk safety score
function calculateBenjiScore(tempC, precip, wind) {
    const tempF = Math.round(tempC * 9/5 + 32);
    let score = 10;
    let label = "Perfect!";
    let className = "score-great";

    if (tempF > 85 || tempF < 25) {
        score -= 6;
    } else if (tempF > 78 || tempF < 40) {
        score -= 3;
    }

    if (precip > 50) {
        score -= 4;
    } else if (precip > 20) {
        score -= 2;
    }

    if (wind > 20) {
        score -= 2;
    }

    score = Math.max(0, score);

    if (score < 5) {
        label = "Be Cautious";
        className = "score-poor";
    } else if (score < 8) {
        label = "Pretty Good";
        className = "score-good";
    }

    return { score: Math.round(score), label, className };
}

// Get random trivia question
function getTrivia() {
    const selectedBreed = state.allBreeds[Math.floor(Math.random() * state.allBreeds.length)];

    const correctAnswer = selectedBreed.temperament ||
        `is known for its ${selectedBreed.bred_for || 'unique personality'}.`;

    const incorrectAlternatives = state.allBreeds
        .filter(b => b.id !== selectedBreed.id && b.temperament)
        .sort(() => 0.5 - Math.random())
        .slice(0, 2)
        .map(b => b.temperament);

    const question = `The ${selectedBreed.name}...`;
    const answerOptions = [correctAnswer, ...incorrectAlternatives].sort(() => 0.5 - Math.random());

    ui.renderTrivia(question, answerOptions, correctAnswer);
}

// Handle walk planning
async function handlePlanWalk() {
    const city = document.getElementById('city-input').value.trim();
    const breedName = document.getElementById('breed-input').value.trim();

    if (!city || !breedName) {
        ui.displayError("Please enter a city and breed name.");
        return;
    }

    ui.showLoader();

    try {
        const breedMatch = state.allBreeds.find(b =>
            b.name.toLowerCase().includes(breedName.toLowerCase())
        );

        if (!breedMatch) {
            throw new Error(`Breed "${breedName}" not found. Try a different name.`);
        }

        state.selectedBreed = breedMatch;

        const coords = await api.fetchCoordinatesForCity(city);
        state.location = coords.name;
        state.currentWeather = await api.fetchWeatherData(coords.latitude, coords.longitude);

        const walkWindows = processWeatherData(state.currentWeather);

        ui.hideLoader();
        ui.renderWalkTimes(walkWindows, state.location);
    } catch (error) {
        ui.displayError(error.message);
    }
}

// Start walk session
async function handleStartWalk(timeIndex) {
    state.isWalkActive = true;
    state.currentPace = 'brisk';
    state.walkStartTime = Date.now();
    ui.updateActivePaceButton(state.currentPace);

    state.timerInterval = setInterval(() => {
        state.walkDuration = Math.floor((Date.now() - state.walkStartTime) / 1000);
        ui.updateTimerDisplay(state.walkDuration);
    }, 1000);

    switchView('active-walk-view');
    await updatePlaylist();
}

// Handle pace change
async function handlePaceChange(newPace) {
    if (state.currentPace === newPace) return;

    state.currentPace = newPace;
    ui.updateActivePaceButton(newPace);
    await updatePlaylist();
}

// End walk session
function handleFinishWalk() {
    state.isWalkActive = false;
    clearInterval(state.timerInterval);
    ui.renderSummary(state.walkDuration);
    switchView('summary-view');
}

// Reset for new walk
function handleNewWalk() {
    state.walkDuration = 0;
    ui.updateTimerDisplay(0);
    switchView('planning-view');
    document.getElementById('results-section').classList.add('hidden');
}

// Update music playlist
async function updatePlaylist() {
    ui.renderPlaylist({});

    try {
        const now = new Date().getHours();
        const currentIndex = state.currentWeather.hourly.time.findIndex(t =>
            new Date(t).getHours() === now);
        const currentWeatherCode = state.currentWeather.hourly.weathercode[currentIndex];

        const recommendations = await api.fetchSpotifyRecommendations(
            null,
            state.currentPace,
            currentWeatherCode,
            state.selectedBreed.temperament
        );

        const playlist = await api.createSpotifyPlaylist(
            null,
            recommendations,
            recommendations.playlistName
        );

        ui.renderPlaylist(playlist);
    } catch (error) {
        ui.displayError("Can't load music right now.");
    }
}

// Initialize app
async function initialize() {
    try {
        const breeds = await api.fetchDogBreeds();
        state.allBreeds = breeds.filter(b => b.temperament);
        ui.setupBreedAutocomplete(state.allBreeds);
    } catch (error) {
        ui.displayError(error.message);
    }
}

// Set up event handlers
function setupEventListeners() {
    document.getElementById('plan-walk-btn').addEventListener('click', handlePlanWalk);

    document.getElementById('walk-times-container').addEventListener('click', (event) => {
        if (event.target.classList.contains('start-walk-btn')) {
            handleStartWalk(event.target.dataset.timeIndex);
        }
    });

    document.getElementById('pace-controls').addEventListener('click', (event) => {
        if (event.target.classList.contains('pace-btn')) {
            handlePaceChange(event.target.dataset.pace);
        }
    });

    document.getElementById('finish-walk-btn').addEventListener('click', handleFinishWalk);
    document.getElementById('start-new-walk-btn').addEventListener('click', handleNewWalk);

    document.getElementById('trivia-btn').addEventListener('click', () => {
        getTrivia();
        document.getElementById('trivia-modal').classList.remove('hidden');
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('trivia-modal').classList.add('hidden');
    });

    document.getElementById('next-trivia-btn').addEventListener('click', getTrivia);
}

// Start app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initialize();
});
