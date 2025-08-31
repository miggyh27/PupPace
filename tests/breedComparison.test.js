// show breed differences clearly
import { buildBreedProfile } from '../src/breedProfiles.js';
import { scoreHour } from '../src/scoring.js';

const mockSun = {
  sunrise: new Date('2024-01-15T07:00:00'),
  sunset: new Date('2024-01-15T17:00:00')
};

const testBreeds = {
  goldenRetriever: {
    name: 'Golden Retriever',
    breed_group: 'Sporting',
    temperament: 'Intelligent, Friendly, Devoted',
    height: { imperial: '21.5 - 24' },
    weight: { imperial: '55 - 75' }
  },
  husky: {
    name: 'Siberian Husky',
    breed_group: 'Working',
    temperament: 'Loyal, Mischievous, Outgoing',
    height: { imperial: '20 - 23.5' },
    weight: { imperial: '35 - 60' }
  },
  pug: {
    name: 'Pug',
    breed_group: 'Toy',
    temperament: 'Docile, Clever, Charming',
    height: { imperial: '10 - 13' },
    weight: { imperial: '14 - 18' }
  }
};

function testBreedDifferences() {
  console.log('breed differences in various conditions\n');

  // moderate heat - should show breed differences
  console.log('moderate heat (85°F, 70% humidity):');
  const moderateHeat = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 29, // 85°F
    apparentC: 32, // 90°F with humidity
    rh: 70,
    uv: 6,
    windMps: 3, // ~7 mph
    gustMps: 3,
    precipPct: 0,
    weathercode: 0,
    cloud: 10
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(moderateHeat, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'good conditions'}`);
    console.log(`  heat sensitivity: ${profile.heatSensitivity.toFixed(2)}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // cold weather - huskies should do better
  console.log('cold weather (15°F, 40% humidity):');
  const coldWeather = {
    timeISO: '2024-01-15T08:00:00',
    tempC: -9, // 15°F
    apparentC: -12, // 10°F with wind chill
    rh: 40,
    uv: 2,
    windMps: 5, // ~11 mph
    gustMps: 5,
    precipPct: 0,
    weathercode: 0,
    cloud: 30
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(coldWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'good conditions'}`);
    console.log(`  cold sensitivity: ${profile.coldSensitivity.toFixed(2)}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // hot pavement - small dogs should be penalized more
  console.log('hot pavement (90°F air, high UV):');
  const hotPavement = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 32, // 90°F
    apparentC: 35, // 95°F
    rh: 50,
    uv: 9,
    windMps: 2, // ~4 mph
    gustMps: 2,
    precipPct: 0,
    weathercode: 0,
    cloud: 5
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(hotPavement, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'good conditions'}`);
    console.log(`  pavement sensitivity: ${profile.pavementSensitivity.toFixed(2)}`);
    console.log(`  height: ${profile.flags.toySized ? 'small' : 'medium/large'}\n`);
  });

  // Test 4: Perfect conditions - should show energy differences
  console.log('perfect conditions (72°F, 50% humidity):');
  const perfectWeather = {
    timeISO: '2024-01-15T10:00:00',
    tempC: 22, // 72°F
    apparentC: 22, // 72°F
    rh: 50,
    uv: 3,
    windMps: 2, // ~4 mph
    gustMps: 2,
    precipPct: 0,
    weathercode: 0,
    cloud: 20
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(perfectWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'perfect conditions'}`);
    console.log(`  energy: ${profile.energyBand}`);
    console.log(`  endurance: ${profile.enduranceMinutes} min`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // Test 5: Windy conditions - small dogs should be affected more
  console.log('windy conditions (75°F, 30 mph gusts):');
  const windyWeather = {
    timeISO: '2024-01-15T12:00:00',
    tempC: 24, // 75°F
    apparentC: 24, // 75°F
    rh: 40,
    uv: 4,
    windMps: 13, // ~30 mph
    gustMps: 13,
    precipPct: 0,
    weathercode: 0,
    cloud: 40
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(windyWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'good conditions'}`);
    console.log(`  wind sensitivity: ${profile.windSensitivity.toFixed(2)}`);
    console.log(`  size: ${profile.flags.toySized ? 'small' : 'medium/large'}\n`);
  });
}

testBreedDifferences();
