// weather scoring that considers breed differences
import { buildBreedProfile } from './breedProfiles.js';

const BASELINE = 6.0; // most hours are around 6, only the best get 9-10

export function scoreDay(weather, breedObj) {
  const prof = buildBreedProfile(breedObj || {});
  const h = weather.hourly, d = weather.daily;

  const sunrise = new Date(d.sunrise?.[0] || Date.now());
  const sunset  = new Date(d.sunset?.[0]  || Date.now());

  const hours = [];
  for (let i = 0; i < h.time.length; i++) {
    const ts = new Date(h.time[i]);
    const hourData = pickHour(h, i);
    const { shaped, raw, reasons, suggest } = scoreHour(hourData, { sunrise, sunset }, prof);
    hours.push({
      timeISO: h.time[i],
      timeLabel: ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      shapedScore: shaped, rawScore: raw, reasons, suggest,
      hourIndex: i
    });
  }

  const shapedScores = hours.map(x => x.shapedScore);
  const median = quantile(shapedScores, 0.5);
  const threshold = Math.max(6.5, median + 0.4);

  const windows = buildWindows(hours, threshold);
  const currentIdx = closestIdx(h.time, Date.now());
  
  // find the best time to walk next
  const bestNext = findBestNextHour(hours, currentIdx);
  
  return {
    current: hours[currentIdx],
    bestNext,
    windows,
    next12: hours.slice(currentIdx, currentIdx + 12)
  };
}

export function scoreHour(x, sun, prof) {
  // convert to fahrenheit and mph
  const tempF   = toF(x.tempC);
  const appF    = toF(x.apparentC);
  const rh      = x.rh ?? null;
  const uv      = x.uv ?? 0;
  const wind    = x.windMps * 2.23694;
  const gust    = (x.gustMps ?? x.windMps) * 2.23694;
  const precip  = x.precipPct ?? 0;
  const code    = x.weathercode ?? 0;
  const cloud   = x.cloud ?? 0;

  let score = BASELINE;
  const reasons = [];

  // dark = not ideal for walking
  const hour = new Date(x.timeISO).getHours();
  const dark = isDark(x.timeISO, sun.sunrise, sun.sunset);
  if (dark) { score -= 1.0; reasons.push('Low light'); }

  // temperature - what it actually feels like
  const feels = appF ?? tempF;
  if (feels > 100 || feels < 5) { score -= 2.2; reasons.push('Extreme temperature'); }
  else if (feels > 92 || feels < 15) { score -= 1.4; }
  else if (feels >= 50 && feels <= 78) { score += 0.8; reasons.push('Comfortable air'); }

  // humidity makes hot weather feel worse
  if (rh != null) {
    if (feels >= 78 && rh >= 80) { score -= 1.2; reasons.push('Humid heat'); }
    else if (feels >= 78 && rh >= 65) { score -= 0.8; }
  }

  // sunburn risk
  if (uv >= 8) { score -= 0.9; reasons.push('High UV'); }
  else if (uv >= 6) { score -= 0.4; }

  // strong winds are bad for small dogs
  if (gust >= 32) { score -= 1.0; reasons.push(`Gusty ${Math.round(gust)} mph`); }
  else if (wind >= 20) { score -= 0.6; }

  // rain and storms
  if (precip >= 70) { score -= 1.2; reasons.push('Heavy rain risk'); }
  else if (precip >= 40) { score -= 0.7; }
  if (code >= 95) { score = Math.min(score, 3.0); reasons.push('Thunderstorms'); }

  // pavement gets really hot in the sun
  const pavementF = Math.round(tempF + Math.max(0, (uv - 2)) * (1 - cloud / 100) * 3.5 + 8);
  if (pavementF >= 135) { score -= 2.0; reasons.push(`Pavement ${pavementF}°F`); }
  else if (pavementF >= 125) { score -= 1.2; reasons.push(`Pavement ${pavementF}°F`); }

  // apply breed-specific penalties and bonuses
  score -= prof.heatSensitivity * heatPenalty(feels, rh);
  score -= prof.coldSensitivity * coldPenalty(feels, wind);
  score -= prof.humiditySensitivity * humidityPenalty(rh, feels);
  score -= prof.uvSensitivity * uvPenalty(uv);
  score -= prof.windSensitivity * windPenalty(wind, gust);
  score -= prof.rainSensitivity * rainPenalty(precip);
  if (pavementF >= 120) score -= prof.pavementSensitivity * 0.8;

  // some breeds handle certain weather better
  if (prof.flags.doubleCoat && feels <= 35) {
    score += 0.8; // huskies love the cold
    reasons.push('Cold weather breed');
  }
  if (prof.flags.brachycephalic && feels >= 75 && rh >= 60) {
    score -= 0.4; // pugs struggle in heat
    reasons.push('Brachy heat penalty');
  }
  if (prof.flags.toySized && feels <= 30) {
    score -= 0.3; // small dogs get cold fast
    reasons.push('Small dog cold penalty');
  }

  // keep score in bounds and adjust distribution
  const raw = clamp(score, 0, 10);
  const shaped = shape(raw);

  // suggest walk style based on conditions
  let pace = prof.energyBand === 'high' ? 'brisk' : 'stroll';
  let duration = prof.enduranceMinutes;
  
  // bad weather = shorter walks
  if (shaped <= 3) {
    pace = 'quick';
    duration = Math.min(duration, 15);
  } else if (shaped <= 5) {
    pace = 'stroll';
    duration = Math.min(duration, 20);
  } else if (shaped >= 8) {
    pace = prof.energyBand === 'high' ? 'brisk' : 'stroll';
    duration = prof.enduranceMinutes; // good weather = full walk
  }
  
  // extreme weather = even shorter
  if (pavementF >= 130 || uv >= 8 || feels >= 90) { 
    if (shaped > 3) pace = 'stroll';
    duration = Math.min(duration, 20); 
  }
  if (feels <= 25 || gust >= 32) { 
    duration = Math.min(duration, 20); 
  }
  if (precip >= 70 || code >= 95) { 
    duration = Math.min(duration, 10); 
  }
  
  duration = Math.max(10, Math.round(duration));

  const suggest = { pace, duration, pavementF };
  return { shaped: Math.round(shaped), raw: Math.round(raw), reasons, suggest };
}

// helper functions
function pickHour(h, i) {
  return {
    timeISO: h.time[i],
    tempC: h.temperature_2m[i],
    apparentC: h.apparent_temperature?.[i],
    rh: h.relative_humidity_2m?.[i],
    uv: h.uv_index?.[i],
    windMps: (h.wind_speed_10m?.[i] ?? 0) / 3.6,
    gustMps: (h.wind_gusts_10m?.[i] ?? 0) / 3.6,
    precipPct: h.precipitation_probability?.[i] ?? 0,
    weathercode: h.weathercode?.[i] ?? 0,
    cloud: h.cloudcover?.[i] ?? 0
  };
}
function toF(c){ return (c * 9) / 5 + 32; }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function quantile(arr, q){ if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); const i=(s.length-1)*q; const lo=Math.floor(i), hi=Math.ceil(i); if(lo===hi) return s[lo]; const h=i-lo; return s[lo]*(1-h)+s[hi]*h; }
function closestIdx(times, now){ let idx=0; for(let i=0;i<times.length;i++){ if(new Date(times[i]).getTime()>=now){ idx=i; break; } } return idx; }
function isDark(iso, rise, set){ const t=new Date(iso).getTime(); return t < rise.getTime()+20*60*1000 || t > set.getTime()-20*60*1000; }

function heatPenalty(feels, rh){ // 0..~2
  let p = 0;
  if (feels >= 95) p += 1.0;
  else if (feels >= 88) p += 0.6;
  if (rh != null && rh >= 75 && feels >= 82) p += 0.6;
  return p;
}
function coldPenalty(feels, wind){ // 0..~1.6
  let p = 0;
  if (feels <= 15) p += 1.0;
  else if (feels <= 25) p += 0.6;
  if (wind >= 18 && feels <= 35) p += 0.4;
  return p;
}
function humidityPenalty(rh, feels){
  if (rh == null) return 0;
  if (feels < 75) return 0;
  if (rh >= 85) return 0.6;
  if (rh >= 70) return 0.3;
  return 0;
}
function uvPenalty(uv){ return uv >= 8 ? 0.5 : uv >= 6 ? 0.25 : 0; }
function windPenalty(w, g){ return g >= 30 ? 0.6 : w >= 20 ? 0.3 : 0; }
function rainPenalty(p){ return p >= 70 ? 0.6 : p >= 40 ? 0.3 : 0; }

function shape(raw){
  // compress scores so only the best hours get 9-10
  if (raw >= 9.5) return 9.6 + (raw - 9.5) * 0.3;
  if (raw >= 8.0) return 8.0 + (raw - 8.0) * 0.7;
  if (raw >= 6.0) return 6.0 + (raw - 6.0) * 0.85;
  return raw * 0.9;
}

export function buildWindows(hours, threshold){
  const out = [];
  let start = null;
  for (let i=0;i<hours.length;i++){
    if (hours[i].shapedScore >= threshold){
      if (start == null) start = i;
    } else if (start != null) {
      out.push(makeWin(hours, start, i-1));
      start = null;
    }
  }
  if (start != null) out.push(makeWin(hours, start, hours.length-1));

  // trim weak edges and split long windows
  const trimmed = [];
  for (const w of out){
    let i0 = w.startIndex, i1 = w.endIndex;
    while (i0 <= i1 && hours[i0].shapedScore < threshold + 0.2) i0++;
    while (i1 >= i0 && hours[i1].shapedScore < threshold + 0.2) i1--;
    for (let a=i0; a<=i1; a += 4){
      const b = Math.min(i1, a + 3);
      trimmed.push(makeWin(hours, a, b));
    }
  }
  // sort by quality and length
  return trimmed
    .map(w => ({ ...w, goodness: w.avgScore * (1 + (w.length - 1) * 0.12) }))
    .sort((a,b)=>b.goodness - a.goodness)
    .slice(0, 4);
}
function makeWin(hours, i0, i1){
  const slice = hours.slice(i0, i1+1);
  const avg = Math.round((slice.reduce((s,x)=>s+x.shapedScore,0)/slice.length)*10)/10;
  return {
    startIndex: i0, endIndex: i1, length: i1-i0+1,
    startTime: hours[i0].timeLabel, endTime: hours[i1].timeLabel,
    avgScore: avg, best: Math.max(...slice.map(x=>x.shapedScore)),
    label: avg >= 8 ? 'Great' : avg >= 7 ? 'Good' : 'Okay'
  };
}

function findBestNextHour(hours, currentIdx) {
  const now = new Date();
  const currentHour = now.getHours();
  
  // look for the best time in the next 24 hours
  let bestHour = null;
  let bestScore = -1;
  
  for (let i = currentIdx; i < Math.min(currentIdx + 24, hours.length); i++) {
    const hour = hours[i];
    const hourTime = new Date(hour.timeISO);
    const hourOfDay = hourTime.getHours();
    
    // prefer certain times of day
    let timePreference = 1.0;
    
    if (hourOfDay >= 6 && hourOfDay <= 10) {
      timePreference = 1.0; // morning walks are great
    } else if (hourOfDay >= 17 && hourOfDay <= 20) {
      timePreference = 0.9; // evening walks too
    } else if (hourOfDay >= 11 && hourOfDay <= 16) {
      timePreference = 0.7; // midday is okay
    } else if (hourOfDay >= 21 && hourOfDay <= 23) {
      timePreference = 0.5; // late but doable
    } else {
      timePreference = 0.3; // very early or late
    }
    
    const adjustedScore = hour.shapedScore * timePreference;
    
    if (adjustedScore > bestScore) {
      bestScore = adjustedScore;
      bestHour = { ...hour, adjustedScore, timePreference };
    }
  }
  
  return bestHour;
}

