// breed traits that affect weather tolerance

const BRACHY = [
  'bulldog','french bulldog','english bulldog','american bulldog','pug',
  'boxer','pekingese','shih tzu','boston terrier','mastiff','cavalier king charles spaniel'
];

const DOUBLE_COAT = [
  'siberian husky','alaskan malamute','samoyed','akita','shiba inu','bernese mountain dog',
  'newfoundland','shepherd','sheepdog','spitz'
];

const SIGHTHOUNDS = [
  'greyhound','whippet','saluki','borzoi','italian greyhound','azawakh','sloughi'
];

function parseAvg(value) {
  // the dog api gives ranges like "55 - 65", so we average them
  if (typeof value === 'number') return value;
  if (!value) return null;
  const nums = String(value).match(/\d+(\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const arr = nums.map(Number);
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function hasAny(hay, needles) {
  const s = hay.toLowerCase();
  return needles.some(n => s.includes(n));
}

export function buildBreedProfile(breed) {
  const name = (breed?.name || '').toLowerCase();
  const group = (breed?.breed_group || '').toLowerCase();
  const temperament = (breed?.temperament || '').toLowerCase();

  const heightIn = parseAvg(breed?.height?.imperial);
  const weightLb = parseAvg(breed?.weight?.imperial);

  const brachycephalic = BRACHY.some(n => name.includes(n));
  const doubleCoat =
    DOUBLE_COAT.some(n => name.includes(n)) ||
    /husky|malamute|samoyed|spitz|shepherd|sheepdog|bernese|newfoundland/.test(name);
  const sighthound = SIGHTHOUNDS.some(n => name.includes(n));
  const toySized = (heightIn && heightIn <= 12) || (weightLb && weightLb <= 12);

  // energy level based on what they were bred for
  const energyBand =
    /herding|working|sporting/.test(group) || /active|energetic|playful|athletic/.test(temperament)
      ? 'high'
      : /hound|terrier|non-sporting|pinscher|schnauzer/.test(group)
      ? 'medium'
      : 'low';

  // base sensitivities - higher means more affected by that weather
  let heatSensitivity = 0.35, coldSensitivity = 0.35;
  let humiditySensitivity = 0.3, uvSensitivity = 0.25, windSensitivity = 0.25, rainSensitivity = 0.25;
  let pavementSensitivity = 0.35;

  if (brachycephalic) { heatSensitivity += 0.35; humiditySensitivity += 0.25; }
  if (doubleCoat)     { heatSensitivity += 0.25; coldSensitivity -= 0.15; }
  if (sighthound)     { coldSensitivity += 0.25; windSensitivity += 0.15; }
  if (toySized)       { coldSensitivity += 0.2; pavementSensitivity += 0.25; windSensitivity += 0.1; }

  if (weightLb && weightLb >= 80) heatSensitivity += 0.1; // heavy dogs overheat easier
  if (heightIn && heightIn <= 14) pavementSensitivity += 0.1; // small dogs closer to hot pavement

  // safe walk duration before weather becomes a problem
  let enduranceMinutes = energyBand === 'high' ? 45 : energyBand === 'medium' ? 35 : 25;

  return {
    name: breed?.name || 'Unknown',
    energyBand,
    enduranceMinutes,
    heatSensitivity: clamp01(heatSensitivity),
    coldSensitivity: clamp01(coldSensitivity),
    humiditySensitivity: clamp01(humiditySensitivity),
    uvSensitivity: clamp01(uvSensitivity),
    windSensitivity: clamp01(windSensitivity),
    rainSensitivity: clamp01(rainSensitivity),
    pavementSensitivity: clamp01(pavementSensitivity),
    flags: { brachycephalic, doubleCoat, sighthound, toySized }
  };
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

