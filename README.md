# PupPace: Your Smart Walk & Run Companion

PupPace is a web app for dog owners that makes walks more fun. It checks the weather and your dog's breed to suggest the best times to go out, then acts as your walking buddy with music that matches your pace.

Just start a walk, pick your speed, and PupPace creates a Spotify playlist that keeps up with you.

## Features

* **Smart Walk Planner**: Finds the best times to walk based on weather and your dog's breed
* **The Benji Meter**: Color-coded safety score for current weather
* **Active Walk Mode**:
    * **Live Timer**: Tracks how long you've been walking
    * **Pace Control**: Pick your speed (Stroll, Brisk, Jog) and music changes
    * **Dynamic Playlists**: Spotify playlists based on weather, dog energy, and pace
* **Post-Walk Summary**: Shows walk duration and saves your playlist
* **Dog Breed Trivia**: Fun quiz game while walking

## What I Used

* **Frontend**: HTML5, CSS3, JavaScript (ES6+)
* **Build Tool**: Vite
* **APIs**:
    * [Open-Meteo](https://open-meteo.com/): Weather data
    * [TheDogAPI](https://thedogapi.com/): Dog breed info
    * [Spotify Web API](https://developer.spotify.com/documentation/web-api): Music playlists

## Getting Started

### What You Need

* Node.js and npm
* Modern web browser
* API keys from Spotify and TheDogAPI

### Setup

1.  **Get the code:**
    ```bash
    git clone https://github.com/your-username/puppace.git
    cd puppace
    ```

2.  **Install packages:**
    ```bash
    npm install
    ```

3.  **Get API keys:**
    * Create a `.env` file in the project root
    * Get keys from [Spotify Dashboard](https://developer.spotify.com/dashboard/) and [TheDogAPI](https://thedogapi.com/signup)
    * Add them to your `.env` file:
        ```env
        SPOTIFY_CLIENT_ID=YourSpotifyClientID
        SPOTIFY_CLIENT_SECRET=YourSpotifyClientSecret
        THEDOGAPI_KEY=YourDogAPIKey
        ```

4.  **Start the app:**
    ```bash
    npm run dev
    ```
    The app will run at whatever URL Vite gives you (usually `http://localhost:5173`).
