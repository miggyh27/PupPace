# PupPace: Your Smart Walk & Run Companion

PupPace is a web app I built for dog owners that makes your daily walks way more fun. It checks the weather and your dog's breed to suggest the best times to go out, and then acts as your walking buddy with music that changes based on your pace.

Just start a walk, pick your speed, and PupPace creates a Spotify playlist that keeps up with you.

## ✨ Features

* **Smart Walk Planner**: Figures out the best times to walk based on weather and what your dog likes.
* **The Benji Meter**: Simple color-coded safety score for the current weather.
* **Active Walk Mode**:
    * **Live Timer**: Keeps track of how long you've been walking.
    * **Pace Control**: Pick your intensity (Stroll, Brisk, Jog) and the music changes right away.
    * **Dynamic PupPace Playlists**: Creates Spotify playlists based on weather, your dog's energy, and how fast you're walking.
* **Post-Walk Summary**: Shows you how long you walked and saves your custom playlist.
* **Dog Breed Trivia**: Fun quiz game to play while you're out walking.

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3, JavaScript (ES6+)
* **Build Tool**: Vite
* **APIs**:
    * [Open-Meteo](https://open-meteo.com/): Weather data
    * [TheDogAPI](https://thedogapi.com/): Dog breed info
    * [Spotify Web API](https://developer.spotify.com/documentation/web-api): Music playlists

## 🚀 Getting Started

Here's how to get this running locally.

### Prerequisites

* Node.js and npm
* Modern web browser
* API keys from Spotify and TheDogAPI

### Installation & Setup

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/your-username/puppace.git
    cd puppace
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your API keys:**
    * Create a `.env` file in the project root
    * Copy from `.env.example`
    * Get your keys from [Spotify Dashboard](https://developer.spotify.com/dashboard/) and [TheDogAPI](https://thedogapi.com/signup)
    * Add them to your `.env` file:
        ```env
        SPOTIFY_CLIENT_ID=YourSpotifyClientID
        SPOTIFY_CLIENT_SECRET=YourSpotifyClientSecret
        THEDOGAPI_KEY=YourDogAPIKey
        ```

4.  **Start the dev server:**
    ```bash
    npm run dev
    ```
    The app will run at whatever URL Vite gives you (usually `http://localhost:5173`).
