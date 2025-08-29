// UI rendering and interactions

// Cache DOM elements for performance
const loader = document.getElementById('loader');
const errorContainer = document.getElementById('error-container');
const breedInput = document.getElementById('breed-input');
const breedSuggestions = document.getElementById('breed-suggestions');
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

// Show loading state
export function showLoader() {
    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    resultsSection.classList.add('hidden');
}

export function hideLoader() {
    loader.classList.add('hidden');
}

// Show error message
export function displayError(message) {
    hideLoader();
    errorContainer.textContent = `⚠️ ${message}`;
    errorContainer.classList.remove('hidden');
}

// Set up breed autocomplete
export function setupBreedAutocomplete(breeds) {
    let currentFocus = -1;

    breedInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        breedSuggestions.innerHTML = '';
        currentFocus = -1;

        if (!query) {
            breedSuggestions.classList.add('hidden');
            return;
        }

        const matches = breeds.filter(breed =>
            breed.name.toLowerCase().includes(query)
        ).slice(0, 5); // Limit to 5 suggestions

        if (matches.length > 0) {
            matches.forEach((breed, index) => {
                const suggestion = document.createElement('div');
                suggestion.className = 'breed-suggestion';
                suggestion.textContent = breed.name;
                suggestion.addEventListener('click', () => {
                    breedInput.value = breed.name;
                    breedSuggestions.classList.add('hidden');
                });
                breedSuggestions.appendChild(suggestion);
            });
            breedSuggestions.classList.remove('hidden');
        } else {
            breedSuggestions.classList.add('hidden');
        }
    });

        breedInput.addEventListener('keydown', (e) => {
        const suggestions = breedSuggestions.children;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus = currentFocus < suggestions.length - 1 ? currentFocus + 1 : 0;
            updateFocus(suggestions, currentFocus);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus = currentFocus > 0 ? currentFocus - 1 : suggestions.length - 1;
            updateFocus(suggestions, currentFocus);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus >= 0 && suggestions[currentFocus]) {
                suggestions[currentFocus].click();
            }
        } else if (e.key === 'Escape') {
            breedSuggestions.classList.add('hidden');
            currentFocus = -1;
        }
    });

    document.addEventListener('click', (e) => {
        if (!breedInput.contains(e.target) && !breedSuggestions.contains(e.target)) {
            breedSuggestions.classList.add('hidden');
        }
    });
}

function updateFocus(suggestions, index) {
    Array.from(suggestions).forEach(suggestion => {
        suggestion.classList.remove('focused');
    });

    if (suggestions[index]) {
        suggestions[index].classList.add('focused');
    }
}

// Render walk recommendations
export function renderWalkTimes(walkWindows, location) {
    locationName.textContent = location;

    const { score, label, className } = walkWindows.benjiMeter;
    benjiScoreEl.textContent = score;
    benjiLabel.textContent = label;
    benjiScoreEl.className = `score-circle ${className}`;

    walkTimesContainer.innerHTML = '';

    if (walkWindows.recommendations.length === 0) {
        walkTimesContainer.innerHTML = '<p>No good walk times found. Weather might be too extreme.</p>';
    } else {
        walkWindows.recommendations.forEach(rec => {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'walk-time-entry';
            timeSlot.innerHTML = `
                <div class="time-details">
                    <div class="time">${rec.time}</div>
                    <div class="details">${rec.temp}°F, ${rec.precip}% precipitation risk</div>
                </div>
                <button class="start-walk-btn" data-time-index="${rec.hourIndex}">Start Walk</button>
            `;
            walkTimesContainer.appendChild(timeSlot);
        });
    }

    resultsSection.classList.remove('hidden');
}

// Update timer display
export function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${remainingSeconds}`;
}

// Update active pace button
export function updateActivePaceButton(activePace) {
    paceControls.querySelectorAll('.pace-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pace === activePace);
    });
}

export function renderPlaylist(playlistData) {
    if (!playlistData || !playlistData.embedUrl) {
        spotifyEmbedContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <p>🎵 Music streaming service temporarily unavailable</p>
                <p style="font-size: 14px; margin-top: 8px;">Service may resume shortly</p>
            </div>`;
        return;
    }

    const embedPlayer = `
        <iframe style="border-radius:12px"
        src="${playlistData.embedUrl}"
        width="100%" height="352" frameBorder="0" allowfullscreen=""
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"></iframe>`;

    spotifyEmbedContainer.innerHTML = embedPlayer;
}

export function renderSummary(durationInSeconds) {
    const totalMinutes = Math.floor(durationInSeconds / 60);
    summaryDuration.textContent = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;

    const activePlaylist = spotifyEmbedContainer.querySelector('iframe');
    if (activePlaylist) {
        summaryPlaylist.innerHTML = '';
        summaryPlaylist.appendChild(activePlaylist.cloneNode(true));
    }
}



export function renderTrivia(question, options, correctAnswer) {
    triviaQuestion.textContent = question;
    triviaOptions.innerHTML = '';
    nextTriviaBtn.classList.add('hidden');

    options.forEach(option => {
        const answerButton = document.createElement('button');
        answerButton.className = 'trivia-option';
        answerButton.textContent = option;
        answerButton.onclick = () => {
            document.querySelectorAll('.trivia-option').forEach(btn =>
                btn.classList.add('disabled'));

            if (option === correctAnswer) {
                answerButton.classList.add('correct');
            } else {
                answerButton.classList.add('incorrect');
            }

            nextTriviaBtn.classList.remove('hidden');
        };
        triviaOptions.appendChild(answerButton);
    });
}

