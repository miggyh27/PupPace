// Main application orchestrator - coordinates between UI and API layers
import * as api from './api.js';
import * as ui from './ui.js';

// Central state store for the entire application lifecycle
const state = {
    spotifyAccessToken: null,    // Cached Spotify API access token
    allBreeds: [],              // Available dog breeds from API
    currentWeather: null,       // Current location's weather forecast
    selectedBreed: null,        // User's chosen dog breed
    location: null,             // Geocoded location name
    isWalkActive: false,        // Whether a walk session is currently running
    walkStartTime: null,        // Timestamp when walk began
    timerInterval: null,        // Reference to the walk timer
    currentPace: 'brisk',       // Current walking pace setting
    walkDuration: 0,           // Total walk time in seconds
};

// Handle navigation between different application screens
function switchView(viewName) {
    document.getElementById('planning-view').classList.add('hidden');
    document.getElementById('active-walk-view').classList.add('hidden');
    document.getElementById('summary-view').classList.add('hidden');
    document.getElementById(viewName).classList.remove('hidden');
}

// Analyze weather forecast and generate optimal walk time recommendations
function processWeatherData(weatherData) {
    const now = new Date();
    const currentHour = now.getHours();
    const hourly = weatherData.hourly;

    // Locate the current hour's data point for Benji Meter calculation
    const currentIndex = hourly.time.findIndex(t =>
        new Date(t).getHours() === currentHour);

    // Calculate safety score for current conditions
    const benjiMeter = calculateBenjiScore(
        hourly.temperature_2m[currentIndex],
        hourly.precipitation_probability[currentIndex],
        hourly.windspeed_10m[currentIndex]
    );

    // Scan next 12 hours for optimal walking windows
    const recommendations = [];
    for (let i = currentIndex; i < currentIndex + 12 && i < hourly.time.length; i++) {
        const score = calculateBenjiScore(
            hourly.temperature_2m[i],
            hourly.precipitation_probability[i],
            hourly.windspeed_10m[i]
        );

        // Only suggest times with acceptable walking conditions
        if (score.score >= 7) {
            recommendations.push({
                time: new Date(hourly.time[i]).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit'
                }),
                temp: Math.round(hourly.temperature_2m[i] * 9/5 + 32), // Convert to Fahrenheit
                precip: hourly.precipitation_probability[i],
                hourIndex: i,
            });
        }
    }

    return {
        benjiMeter,
        recommendations: recommendations.slice(0, 4) // Show top 4 recommendations
    };
}

// Evaluate walking conditions and assign a safety/comfort score (0-10)
function calculateBenjiScore(tempC, precip, wind) {
    const tempF = Math.round(tempC * 9/5 + 32);
    let score = 10; // Start with perfect conditions
    let label = "Perfect!";
    let className = "score-great";

    // Temperature comfort assessment (dogs prefer 40-78°F range)
    if (tempF > 85 || tempF < 25) {
        score -= 6; // Extremely hot/cold conditions
    } else if (tempF > 78 || tempF < 40) {
        score -= 3; // Moderately uncomfortable temperatures
    }

    // Precipitation risk evaluation
    if (precip > 50) {
        score -= 4; // Heavy rain likely
    } else if (precip > 20) {
        score -= 2; // Light rain possible
    }

    // Wind comfort consideration
    if (wind > 20) {
        score -= 2; // Windy conditions can be uncomfortable
    }

    score = Math.max(0, score); // Clamp to valid range

    // Determine condition category and styling
    if (score < 5) {
        label = "Be Cautious";
        className = "score-poor";
    } else if (score < 8) {
        label = "Pretty Good";
        className = "score-good";
    }

    return { score: Math.round(score), label, className };
}

// Create an engaging dog breed trivia question with multiple choice answers
function getTrivia() {
    const randomBreed = state.allBreeds[Math.floor(Math.random() * state.allBreeds.length)];

    // Use breed temperament as the correct answer, with fallback for breeds without temperament data
    const correctFact = randomBreed.temperament ||
        `is known for its ${randomBreed.bred_for || 'unique personality'}.`;

    // Select two incorrect options from other breeds that have temperament data
    const incorrectOptions = state.allBreeds
        .filter(b => b.id !== randomBreed.id && b.temperament)
        .sort(() => 0.5 - Math.random())
        .slice(0, 2)
        .map(b => b.temperament);

    const question = `The ${randomBreed.name}...`;
    const options = [correctFact, ...incorrectOptions].sort(() => 0.5 - Math.random());

    ui.renderTrivia(question, options, correctFact);
}

// Process user input for walk planning and fetch weather analysis
async function handlePlanWalk() {
    const city = document.getElementById('city-input').value.trim();
    const breedId = document.getElementById('breed-select').value;

    // Validate required inputs before proceeding
    if (!city || !breedId) {
        ui.displayError("Please enter a city and select a breed.");
        return;
    }

    ui.showLoader();

    try {
        // Store user's breed selection for later use
        state.selectedBreed = state.allBreeds.find(b => b.id == breedId);

        // Convert city name to coordinates and fetch weather data
        const coords = await api.fetchCoordinatesForCity(city);
        state.location = coords.name;
        state.currentWeather = await api.fetchWeatherData(coords.latitude, coords.longitude);

        // Process weather data into actionable walk recommendations
        const walkWindows = processWeatherData(state.currentWeather);

        ui.hideLoader();
        ui.renderWalkTimes(walkWindows, state.location);
    } catch (error) {
        ui.displayError(error.message);
    }
}

// Initialize a new walking session with selected time slot
async function handleStartWalk(timeIndex) {
    state.isWalkActive = true;
    state.currentPace = 'brisk'; // Default to brisk walking pace
    state.walkStartTime = Date.now();
    ui.updateActivePaceButton(state.currentPace);

    // Set up live timer that updates every second
    state.timerInterval = setInterval(() => {
        state.walkDuration = Math.floor((Date.now() - state.walkStartTime) / 1000);
        ui.updateTimerDisplay(state.walkDuration);
    }, 1000);

    switchView('active-walk-view');
    await updatePlaylist(); // Generate initial music selection
}

// Respond to user pace selection and update music accordingly
async function handlePaceChange(newPace) {
    if (state.currentPace === newPace) return; // No change needed

    state.currentPace = newPace;
    ui.updateActivePaceButton(newPace);
    await updatePlaylist(); // Refresh music to match new pace
}

// Complete the active walking session and show results
function handleFinishWalk() {
    state.isWalkActive = false;
    clearInterval(state.timerInterval); // Stop the live timer
    ui.renderSummary(state.walkDuration);
    switchView('summary-view');
}

// Reset application state for planning a new walk
function handleNewWalk() {
    state.walkDuration = 0;
    ui.updateTimerDisplay(0);
    switchView('planning-view');
    document.getElementById('results-section').classList.add('hidden');
}

// Generate fresh music recommendations based on current walk conditions
async function updatePlaylist() {
    ui.renderPlaylist(null); // Clear existing playlist while loading

    try {
        // Get current weather conditions for music personalization
        const now = new Date().getHours();
        const currentIndex = state.currentWeather.hourly.time.findIndex(t =>
            new Date(t).getHours() === now);
        const currentWeatherCode = state.currentWeather.hourly.weathercode[currentIndex];

        // Fetch personalized track recommendations from Spotify
        const recommendations = await api.fetchSpotifyRecommendations(
            state.spotifyAccessToken,
            state.currentPace,
            currentWeatherCode,
            state.selectedBreed.temperament
        );

        // Create embeddable playlist from the recommended tracks
        const playlist = await api.createSpotifyPlaylist(
            state.spotifyAccessToken,
            recommendations.trackUris,
            recommendations.playlistName
        );

        ui.renderPlaylist(playlist.embedUrl);
    } catch (error) {
        console.error('Playlist update failed:', error);
        ui.displayError("Unable to update music selection.");
    }
}

// Bootstrap the application with required data and services
async function initialize() {
    try {
        // Parallel loading of Spotify authentication and breed data for faster startup
        const [token, breeds] = await Promise.all([
            api.getSpotifyToken(),
            api.fetchDogBreeds()
        ]);

        // Cache authentication token and filter breeds with complete temperament data
        state.spotifyAccessToken = token;
        state.allBreeds = breeds.filter(b => b.temperament);

        // Populate the breed selection interface
        ui.renderBreedOptions(state.allBreeds);
    } catch (error) {
        ui.displayError(error.message);
    }
}

// Wire up all user interaction handlers
function setupEventListeners() {
    // Main walk planning workflow
    document.getElementById('plan-walk-btn').addEventListener('click', handlePlanWalk);

    // Handle walk time selection from weather recommendations
    document.getElementById('walk-times-container').addEventListener('click', (event) => {
        if (event.target.classList.contains('start-walk-btn')) {
            handleStartWalk(event.target.dataset.timeIndex);
        }
    });

    // Pace adjustment during active walks
    document.getElementById('pace-controls').addEventListener('click', (event) => {
        if (event.target.classList.contains('pace-btn')) {
            handlePaceChange(event.target.dataset.pace);
        }
    });

    // Walk session management
    document.getElementById('finish-walk-btn').addEventListener('click', handleFinishWalk);
    document.getElementById('start-new-walk-btn').addEventListener('click', handleNewWalk);

    // Trivia game interactions
    document.getElementById('trivia-btn').addEventListener('click', () => {
        getTrivia();
        document.getElementById('trivia-modal').classList.remove('hidden');
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('trivia-modal').classList.add('hidden');
    });

    document.getElementById('next-trivia-btn').addEventListener('click', getTrivia);
}

// Application entry point - initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initialize();
});
