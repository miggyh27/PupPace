import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

// cors setup - restrict origins in prod
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// limit payload size
app.use(express.json({ limit: '1mb' }));

// security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// rate limiting  per IP
const requestCounts = new Map();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60 * 1000;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  const recentRequests = requests.filter(time => time > windowStart);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return res.status(429).json({ 
      error: 'Too many requests',
      retryAfter: Math.ceil((recentRequests[0] + RATE_WINDOW - now) / 1000)
    });
  }
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  next();
}

// validate spotify API parameters
function validateSpotifyParams(req, res, next) {
  const allowedParams = [
    'seed_artists', 'seed_tracks', 'seed_genres',
    'limit', 'min_energy', 'max_energy', 'target_energy',
    'min_valence', 'max_valence', 'target_valence',
    'min_tempo', 'max_tempo', 'target_tempo'
  ];

  const invalidParams = Object.keys(req.query).filter(param => !allowedParams.includes(param));
  if (invalidParams.length > 0) {
    return res.status(400).json({ 
      error: 'Invalid parameters',
      invalidParams 
    });
  }

  // validate numeric parameters
  const { limit, min_tempo, max_tempo, target_tempo } = req.query;
  
  if (limit && (!Number.isInteger(+limit) || +limit < 1 || +limit > 100)) {
    return res.status(400).json({ error: 'Limit must be between 1 and 100' });
  }
  
  if (min_tempo && (!Number.isFinite(+min_tempo) || +min_tempo < 0 || +min_tempo > 200)) {
    return res.status(400).json({ error: 'Invalid min_tempo value' });
  }
  
  if (max_tempo && (!Number.isFinite(+max_tempo) || +max_tempo < 0 || +max_tempo > 200)) {
    return res.status(400).json({ error: 'Invalid max_tempo value' });
  }
  
  if (target_tempo && (!Number.isFinite(+target_tempo) || +target_tempo < 0 || +target_tempo > 200)) {
    return res.status(400).json({ error: 'Invalid target_tempo value' });
  }

  next();
}

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, PORT = 8787 } = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env');
  process.exit(1);
}

// token caching
let _token = null;
let _tokenExpiresAt = 0;

async function getAppToken() {
  const now = Date.now();
  if (_token && now < _tokenExpiresAt - 60_000) return _token;

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Spotify token error: ${res.status} ${errorText}`);
    }

    const json = await res.json();
    _token = json.access_token;
    _tokenExpiresAt = Date.now() + json.expires_in * 1000;
    return _token;
  } catch (error) {
    console.error('Failed to get Spotify token:', error);
    throw new Error('Authentication service unavailable');
  }
}

// spotify recommendations endpoint
app.get('/api/spotify/recommendations', rateLimit, validateSpotifyParams, async (req, res) => {
  try {
    const token = await getAppToken();

    // build query params
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null && v !== '') {
        const value = String(v).trim();
        if (value.length > 0 && value.length < 100) {
          params.set(k, value);
        }
      }
    }
    
    if (!params.get('limit')) params.set('limit', '20');

    const spotifyUrl = `https://api.spotify.com/v1/recommendations?${params.toString()}`;
    const r = await fetch(spotifyUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });

    if (!r.ok) {
      const errorText = await r.text();
      console.error(`Spotify API error: ${r.status} - ${errorText}`);
      return res.status(502).json({ 
        error: 'Music service temporarily unavailable',
        details: process.env.NODE_ENV === 'development' ? errorText : undefined
      });
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
  } catch (error) {
    console.error('Spotify recommendations error:', error);
    res.status(500).json({ 
      error: 'Music service unavailable',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// health check
app.get('/api/health', (_req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// graceful shutdown
process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('SIGINT', () => {
  process.exit(0);
});

// error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`PupPace server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
