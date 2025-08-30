// ui stuff - showing/hiding things and handling clicks

// get all the page elements we need
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

// show/hide loading spinner
export function showLoader() {
  loader.classList.remove('hidden');
  errorContainer.classList.add('hidden');
  resultsSection.classList.add('hidden');
}
export function hideLoader() {
  loader.classList.add('hidden');
}

// show error messages
export function displayError(message) {
  hideLoader();
  errorContainer.textContent = `⚠️ ${message}`;
  errorContainer.classList.remove('hidden');
}

// breed search with suggestions
export function setupBreedAutocomplete(breeds, initial = '') {
  if (initial) breedInput.value = initial;

  let currentFocus = -1;
  let debTimer = null;

  breedInput.setAttribute('role', 'combobox');
  breedInput.setAttribute('aria-expanded', 'false');
  breedSuggestions.setAttribute('role', 'listbox');

  const renderMatches = (query) => {
    breedSuggestions.innerHTML = '';
    currentFocus = -1;

    const list = breeds
      .filter(b => b.name.toLowerCase().includes(query))
      .slice(0, 7);

    if (!list.length) {
      breedSuggestions.classList.add('hidden');
      breedInput.setAttribute('aria-expanded', 'false');
      return;
    }

    for (const breed of list) {
      const item = document.createElement('div');
      item.className = 'breed-suggestion';
      item.setAttribute('role', 'option');

      const idx = breed.name.toLowerCase().indexOf(query);
      if (idx >= 0) {
        const before = breed.name.slice(0, idx);
        const match = breed.name.slice(idx, idx + query.length);
        const after = breed.name.slice(idx + query.length);
        item.innerHTML = `${escapeHtml(before)}<strong>${escapeHtml(match)}</strong>${escapeHtml(after)}`;
      } else {
        item.textContent = breed.name;
      }

      item.addEventListener('click', () => {
        breedInput.value = breed.name;
        breedSuggestions.classList.add('hidden');
        breedInput.setAttribute('aria-expanded', 'false');
      });
      breedSuggestions.appendChild(item);
    }

    breedSuggestions.classList.remove('hidden');
    breedInput.setAttribute('aria-expanded', 'true');
  };

  breedInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    clearTimeout(debTimer);
    if (!query) {
      breedSuggestions.classList.add('hidden');
      breedInput.setAttribute('aria-expanded', 'false');
      return;
    }
    debTimer = setTimeout(() => renderMatches(query), 140);
  });

  breedInput.addEventListener('keydown', (e) => {
    const suggestions = Array.from(breedSuggestions.children);
    if (!suggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentFocus = (currentFocus + 1) % suggestions.length;
      updateFocus(suggestions, currentFocus);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentFocus = (currentFocus - 1 + suggestions.length) % suggestions.length;
      updateFocus(suggestions, currentFocus);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      suggestions[currentFocus]?.click();
    } else if (e.key === 'Escape') {
      breedSuggestions.classList.add('hidden');
      breedInput.setAttribute('aria-expanded', 'false');
      currentFocus = -1;
    }
  });

  document.addEventListener('click', (e) => {
    if (!breedInput.contains(e.target) && !breedSuggestions.contains(e.target)) {
      breedSuggestions.classList.add('hidden');
      breedInput.setAttribute('aria-expanded', 'false');
    }
  });
}

function updateFocus(nodes, i) {
  nodes.forEach(n => n.classList.remove('focused'));
  if (nodes[i]) nodes[i].classList.add('focused');
}
function escapeHtml(s) { 
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); 
}

// Show the weather forecast and best walking times
export function renderWalkTimes(walk, location) {
  locationName.textContent = location;

  const { score, label, className } = walk.benjiMeter;
  benjiScoreEl.textContent = score;
  benjiLabel.textContent = label;
  benjiScoreEl.className = `score-circle ${className}`;

  walkTimesContainer.innerHTML = '';

  // Add best next hour if available
  if (walk.bestNext) {
    const bestNextHeader = document.createElement('h4');
    bestNextHeader.textContent = '⭐ Best Next Walk';
    walkTimesContainer.appendChild(bestNextHeader);

    const bestNextGrid = document.createElement('div');
    bestNextGrid.className = 'walk-times-grid';

    const bestNextEl = document.createElement('div');
    bestNextEl.className = 'walk-time-entry best-next';
    
    const chipHtml = (walk.bestNext.reasons || []).slice(0,3).map(t => `<span class="reason-chip">${escapeHtml(t)}</span>`).join('');
    const suggestHtml = walk.bestNext.suggest
      ? `<div class="suggest">Suggested: <strong>${escapeHtml(walk.bestNext.suggest.pace)}</strong> · ${walk.bestNext.suggest.duration} min</div>`
      : '';
    
    const timeQuality = walk.bestNext.timePreference >= 0.9 ? 'Perfect time' : 
                       walk.bestNext.timePreference >= 0.7 ? 'Good time' : 
                       walk.bestNext.timePreference >= 0.5 ? 'Okay time' : 'Late time';
    
    bestNextEl.innerHTML = `
      <div class="time-details">
        <div class="time">${escapeHtml(walk.bestNext.time)} · ${escapeHtml(timeQuality)}</div>
        <div class="weather-info">
          <span class="weather-item">🌡️ ${walk.bestNext.temp}°F</span>
          <span class="weather-item">💧 ${walk.bestNext.precip}%</span>
          <span class="weather-item">💨 ${walk.bestNext.wind}mph</span>
        </div>
        <div class="score-badge ${walk.bestNext.className}">${walk.bestNext.score}/10</div>
        <div class="chips">${chipHtml}</div>
        ${suggestHtml}
      </div>
      <button class="start-walk-btn" data-time-index="${walk.bestNext.hourIndex}">Start Walk</button>
    `;
    bestNextGrid.appendChild(bestNextEl);
    walkTimesContainer.appendChild(bestNextGrid);
  }

  const grid = document.createElement('div');
  grid.className = 'walk-times-grid';

  if (walk.topRecommendations.length) {
    const topHeader = document.createElement('h4');
    topHeader.textContent = '🏆 Best Walk Windows Today';
    walkTimesContainer.appendChild(topHeader);

    walk.topRecommendations.forEach(win => {
      const el = document.createElement('div');
      el.className = 'walk-time-entry top-recommendation';
      el.innerHTML = `
        <div class="time-details">
          <div class="time">${escapeHtml(win.time)} · ${escapeHtml(win.label)}</div>
          <div class="weather-info">
            <span class="weather-item">Avg score: ${win.avg}</span>
            <span class="weather-item">Length: ${win.length}h</span>
          </div>
          <div class="score-badge ${win.className}">${win.score}/10</div>
        </div>
        <button class="start-walk-btn" data-time-index="${win.startIndex}" title="Start at the beginning of this window">Start Walk</button>
      `;
      grid.appendChild(el);
    });
  }

  const nextHeader = document.createElement('h4');
  nextHeader.textContent = '📅 Next 12 Hours';
  walkTimesContainer.appendChild(nextHeader);

  walk.currentAndNext.forEach(rec => {
    const el = document.createElement('div');
    el.className = 'walk-time-entry';
    
    const chipHtml = (rec.reasons || []).slice(0,3).map(t => `<span class="reason-chip">${escapeHtml(t)}</span>`).join('');
    const suggestHtml = rec.suggest
      ? `<div class="suggest">Suggested: <strong>${escapeHtml(rec.suggest.pace)}</strong> · ${rec.suggest.duration} min</div>`
      : '';
    
    el.innerHTML = `
      <div class="time-details">
        <div class="time">${escapeHtml(rec.time)}</div>
        <div class="weather-info">
          <span class="weather-item">🌡️ ${rec.temp}°F</span>
          <span class="weather-item">💧 ${rec.precip}%</span>
          <span class="weather-item">💨 ${rec.wind}mph</span>
        </div>
        <div class="score-badge ${rec.className}">${rec.score}/10</div>
        <div class="chips">${chipHtml}</div>
        ${suggestHtml}
      </div>
      <button class="start-walk-btn" data-time-index="${rec.hourIndex}">Start Walk</button>
    `;
    grid.appendChild(el);
  });

  walkTimesContainer.appendChild(grid);
  resultsSection.classList.remove('hidden');
}

// Update the walk timer display
export function updateTimerDisplay(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  timerDisplay.textContent = `${mm}:${ss}`;
}

// Highlight the currently selected walking pace
export function updateActivePaceButton(activePace) {
  paceControls.querySelectorAll('.pace-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pace === activePace);
    btn.setAttribute('aria-pressed', String(btn.dataset.pace === activePace));
  });
}

// Show the Spotify player and track list, or a loading placeholder
export function renderPlaylist(playlistData) {
  if (!playlistData || (!playlistData.embedUrl && !(playlistData.tracks?.length))) {
    spotifyEmbedContainer.innerHTML = `
      <div class="player-skeleton">
        <div class="skeleton-bar"></div>
        <div class="skeleton-list">
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
        </div>
      </div>`;
    return;
  }

  let trackListHtml = '';
  if (playlistData.tracks?.length) {
    trackListHtml = `
      <div class="track-list">
        ${playlistData.tracks.slice(0, 8).map(t => `
          <a class="track-row" href="${t.url}" target="_blank" rel="noopener">
            <img class="track-art" src="${t.image || ''}" alt="" />
            <div class="track-meta">
                      <div class="track-name">${escapeHtml(t.name)}</div>
        <div class="track-artist">${escapeHtml(t.artists)}</div>
            </div>
            <span class="track-open">↗</span>
          </a>
        `).join('')}
      </div>`;
  }

  const embed = playlistData.embedUrl
    ? `<iframe class="player-embed"
         src="${playlistData.embedUrl}"
         frameBorder="0" allowfullscreen
         allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
         loading="lazy"></iframe>`
    : '';

  spotifyEmbedContainer.innerHTML = `
    <div class="player-card">
      ${embed}
      ${trackListHtml}
    </div>`;
}

// Show the walk summary with duration and saved playlist
export function renderSummary(durationInSeconds, petName = 'your pup') {
  const mins = Math.floor(durationInSeconds / 60);
  summaryDuration.textContent = `${mins} minute${mins === 1 ? '' : 's'}`;
  
  const petNameDisplay = document.getElementById('pet-name-display');
  if (petNameDisplay) {
    petNameDisplay.textContent = petName;
  }

  const iframe = spotifyEmbedContainer.querySelector('iframe');
  summaryPlaylist.innerHTML = '';
  if (iframe) summaryPlaylist.appendChild(iframe.cloneNode(true));
}

// Set up the trivia game interface
export function renderTrivia(question, options, correctAnswer) {
  triviaQuestion.textContent = question;
  triviaOptions.innerHTML = '';
  nextTriviaBtn.classList.add('hidden');

  options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'trivia-option';
    btn.textContent = option;
    btn.onclick = () => {
      document.querySelectorAll('.trivia-option').forEach(b => b.classList.add('disabled'));
      (option === correctAnswer ? btn.classList.add('correct') : btn.classList.add('incorrect'));
      nextTriviaBtn.classList.remove('hidden');
    };
    triviaOptions.appendChild(btn);
  });
}

export function renderBreedPhotoGame(imageUrl, question, options, correctAnswer) {
  triviaQuestion.textContent = question;
  triviaOptions.innerHTML = '';
  nextTriviaBtn.classList.add('hidden');

  const imgWrap = document.createElement('div');
  imgWrap.className = 'breed-image-container';
  imgWrap.innerHTML = `<img src="${imageUrl}" alt="Dog breed to guess" class="breed-image">`;
  triviaOptions.appendChild(imgWrap);

  options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'trivia-option';
    btn.textContent = option;
    btn.onclick = () => {
      document.querySelectorAll('.trivia-option').forEach(b => b.classList.add('disabled'));
      (option === correctAnswer ? btn.classList.add('correct') : btn.classList.add('incorrect'));
      nextTriviaBtn.classList.remove('hidden');
    };
    triviaOptions.appendChild(btn);
  });
}

