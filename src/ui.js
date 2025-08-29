// Frontend rendering and user interaction handling

// Cache frequently accessed DOM elements for performance
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('error-container');
const breedSelect = document.getElementById('breed-select');
const locationName = document.getElementById('location-name');
const benjiScoreEl = document.getElementById('benji-score');
const benjiLabel = document.getElementById('benji-label');
const walkTimesContainer = document.getElementById('walk-times-container');
const resultsSection = document.getElementById('results-section');
const timerDisplay = document.getElementById('timer');
const paceControls = document.getElementById('pace-controls');
const spotifyEmbedContainer = document.getElementById('spotify-embed-container');
const summaryDuration = document.getElementById('summary-duration');
const summaryPlaylist = document.getElementById('summary-playlist');
const triviaQuestion = document.getElementById('trivia-question');
const triviaOptions = document.getElementById('trivia-options');
const nextTriviaBtn = document.getElementById('next-trivia-btn');

// Control loading spinner and hide other content during async operations
export function showLoader() {
    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    resultsSection.classList.add('hidden');
}

export function hideLoader() {
    loader.classList.add('hidden');
}

// Show user-friendly error messages with consistent styling
export function displayError(message) {
    hideLoader();
    errorContainer.textContent = `⚠️ ${message}`;
    errorContainer.classList.remove('hidden');
}

// Build the breed selection dropdown with available dog breeds
export function renderBreedOptions(breeds) {
    breedSelect.innerHTML = '<option value="">Select a breed</option>';

    breeds.forEach(breed => {
        if (breed.name) {
            const option = document.createElement('option');
            option.value = breed.id;
            option.textContent = breed.name;
            breedSelect.appendChild(option);
        }
    });
}

// Render the weather analysis results and optimal walk time recommendations
export function renderWalkTimes(walkWindows, location) {
    locationName.textContent = location;

    // Apply the Benji Meter safety score styling and text
    const { score, label, className } = walkWindows.benjiMeter;
    benjiScoreEl.textContent = score;
    benjiLabel.textContent = label;
    benjiScoreEl.className = `score-circle ${className}`;

    // Reset the recommendations container
    walkTimesContainer.innerHTML = '';

    if (walkWindows.recommendations.length === 0) {
        walkTimesContainer.innerHTML = '<p>No ideal walk times in the next 12 hours. Conditions may be too extreme.</p>';
    } else {
        // Generate interactive cards for each recommended time slot
        walkWindows.recommendations.forEach(rec => {
            const entry = document.createElement('div');
            entry.className = 'walk-time-entry';
            entry.innerHTML = `
                <div class="time-details">
                    <div class="time">${rec.time}</div>
                    <div class="details">${rec.temp}°F, ${rec.precip}% chance of rain</div>
                </div>
                <button class="start-walk-btn" data-time-index="${rec.hourIndex}">Start Walk</button>
            `;
            walkTimesContainer.appendChild(entry);
        });
    }

    resultsSection.classList.remove('hidden');
}

// Format and display the elapsed walk time in MM:SS format
export function updateTimerDisplay(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;
}

// Visually indicate which pace option is currently selected
export function updateActivePaceButton(activePace) {
    document.querySelectorAll('.pace-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pace === activePace);
    });
}

// Insert the Spotify embed player into the designated container
export function renderPlaylist(embedUrl) {
    if (!embedUrl) {
        spotifyEmbedContainer.innerHTML = '<p>Unable to load music. Try changing your pace!</p>';
        return;
    }

    // Create responsive Spotify embed with proper permissions
    const iframe = `
        <iframe style="border-radius:12px"
        src="${embedUrl}"
        width="100%" height="352" frameBorder="0" allowfullscreen=""
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"></iframe>`;
    spotifyEmbedContainer.innerHTML = iframe;
}

// Display the completed walk statistics and preserve the final playlist
export function renderSummary(durationInSeconds) {
    const minutes = Math.floor(durationInSeconds / 60);
    summaryDuration.textContent = `${minutes} minute${minutes !== 1 ? 's' : ''}`;

    // Preserve the final playlist for the walk summary
    const currentPlaylist = spotifyEmbedContainer.querySelector('iframe');
    if (currentPlaylist) {
        summaryPlaylist.innerHTML = '';
        summaryPlaylist.appendChild(currentPlaylist.cloneNode(true));
    }
}

// Set up an interactive dog breed trivia question with multiple choice options
export function renderTrivia(question, options, correctAnswer) {
    triviaQuestion.textContent = question;
    triviaOptions.innerHTML = '';
    nextTriviaBtn.classList.add('hidden');

    options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'trivia-option';
        button.textContent = option;
        button.onclick = () => {
            // Prevent further interaction after answering
            document.querySelectorAll('.trivia-option').forEach(btn =>
                btn.classList.add('disabled'));

            // Provide immediate visual feedback on correctness
            if (option === correctAnswer) {
                button.classList.add('correct');
            } else {
                button.classList.add('incorrect');
            }

            nextTriviaBtn.classList.remove('hidden');
        };
        triviaOptions.appendChild(button);
    });
}
