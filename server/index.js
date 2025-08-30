// proxy server to keep spotify secrets safe
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// rate limiting - 100 requests per minute per IP
const requestCounts = new Map();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60 * 1000;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  const recentRequests = requests.filter(time => time > windowStart);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  next();
}

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, PORT = 8787 } = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env');
  process.exit(1);
}

// cache the token so we don't hit spotify's auth endpoint every time
let _token = null;
let _tokenExpiresAt = 0;

async function getAppToken() {
  const now = Date.now();
  if (_token && now < _tokenExpiresAt - 60_000) return _token;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization:
        'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Spotify token error: ${res.status} ${txt}`);
  }

  const json = await res.json();
  _token = json.access_token;
  _tokenExpiresAt = Date.now() + json.expires_in * 1000;
  return _token;
}

// spotify recommendations endpoint
app.get('/api/spotify/recommendations', rateLimit, async (req, res) => {
  try {
    const token = await getAppToken();

    // only allow certain params
    const allowed = [
      'seed_artists', 'seed_tracks', 'seed_genres',
      'limit',
      'min_energy','max_energy','target_energy',
      'min_valence','max_valence','target_valence',
      'min_tempo','max_tempo','target_tempo'
    ];
    const params = new URLSearchParams();
    for (const k of allowed) {
      if (req.query[k] != null && req.query[k] !== '') {
        const value = String(req.query[k]).trim();
        if (value.length > 0 && value.length < 100) {
          params.set(k, value);
        }
      }
    }
    if (!params.get('limit')) params.set('limit', '20');

    const r = await fetch('https://api.spotify.com/v1/recommendations?' + params.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: `Spotify recs error: ${r.status} ${txt}` });
    }

    const data = await r.json();
    const tracks = (data.tracks || []).map(t => ({
      id: t.id,
      name: t.name,
      artists: t.artists?.map(a => a.name).join(', ') || 'Unknown',
      url: t.external_urls?.spotify,
      preview_url: t.preview_url,
      image: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null,
    }));

    res.json({ tracks });
  } catch (e) {
    console.error('Spotify API error:', e.message);
    res.status(500).json({ error: 'Music service unavailable' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`PupPace server running on http://localhost:${PORT}`);
});
