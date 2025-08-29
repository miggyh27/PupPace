# PupPace: Your Smart Walk & Run Companion

PupPace is an innovative web app for dog owners that transforms your daily walk into a personalized experience. It not only helps you plan the best time to go out by analyzing weather and your dog's breed, but it also acts as an active companion during your walk.

Start a session, set your pace, and PupPace curates a dynamic Spotify playlist that matches your energy in real-time.

## ✨ Features

* **Smart Walk Planner**: Recommends the best times to walk your dog based on local weather forecasts and breed-specific needs.
* **The Benji Meter**: A clear, color-coded safety score for current weather conditions.
* **Active Walk Mode**:
    * **Live Timer**: Track the duration of your walk or run.
    * **Pace Control**: Choose your intensity (Stroll, Brisk, Jog), and the music adapts instantly.
    * **Dynamic PupPace Playlists**: Real-time Spotify playlist generation based on weather, your dog's energy, and *your current pace*.
* **Post-Walk Summary**: Get a summary of your walk duration and save your uniquely generated playlist.
* **Dog Breed Trivia**: A fun trivia game to keep you entertained on your walk.

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3, JavaScript (ES6+)
* **Build Tool**: Vite
* **APIs**:
    * [Open-Meteo](https://open-meteo.com/): Weather forecasting.
    * [TheDogAPI](https://thedogapi.com/): Dog breed information.
    * [Spotify Web API](https://developer.spotify.com/documentation/web-api): Dynamic music curation.

## 🚀 Getting Started

Follow these instructions to get the project running on your local machine.

### Prerequisites

* Node.js and npm installed.
* A modern web browser that supports the Geolocation API (for future distance tracking).
* API keys for TheDogAPI and Spotify.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/puppace.git](https://github.com/your-username/puppace.git)
    cd puppace
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    * Create a file named `.env` in the project root.
    * Copy the contents of `.env.example` into your new `.env` file.
    * Obtain your API keys from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/) and [TheDogAPI](https://thedogapi.com/signup).
    * Fill in your `.env` file with your credentials:
        ```env
        SPOTIFY_CLIENT_ID=YourSpotifyClientID
        SPOTIFY_CLIENT_SECRET=YourSpotifyClientSecret
        THEDOGAPI_KEY=YourDogAPIKey
        ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The app will be available at the local URL provided by Vite (e.g., `http://localhost:5173`).
