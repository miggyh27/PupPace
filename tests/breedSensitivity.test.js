// breed sensitivity differences in moderate conditions
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

function testBreedSensitivity() {
  console.log('breed sensitivity differences\n');

  // warm but not extreme - should show heat sensitivity differences
  console.log('warm weather (80°F, 70% humidity):');
  const warmWeather = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 27, // 80°F
    apparentC: 30, // 86°F with humidity
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
    const result = scoreHour(warmWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'good conditions'}`);
    console.log(`  heat sensitivity: ${profile.heatSensitivity.toFixed(2)}`);
    console.log(`  brachycephalic: ${profile.flags.brachycephalic ? 'yes' : 'no'}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // cool but not extreme - should show cold sensitivity differences
  console.log('cool weather (25°F, 40% humidity):');
  const coolWeather = {
    timeISO: '2024-01-15T08:00:00',
    tempC: -4, // 25°F
    apparentC: -7, // 19°F with wind chill
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
    const result = scoreHour(coolWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'good conditions'}`);
    console.log(`  cold sensitivity: ${profile.coldSensitivity.toFixed(2)}`);
    console.log(`  double coat: ${profile.flags.doubleCoat ? 'yes' : 'no'}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // hot pavement but not extreme - should show pavement sensitivity
  console.log('hot pavement (85°F air, UV 8):');
  const hotPavement = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 29, // 85°F
    apparentC: 31, // 88°F
    rh: 50,
    uv: 8,
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
    console.log(`  height: ${profile.flags.toySized ? 'small (closer to ground)' : 'medium/large'}\n`);
  });

  // Test 4: Windy but not extreme (20 mph gusts) - should show wind sensitivity
  console.log('windy weather (20 mph gusts):');
  const windyWeather = {
    timeISO: '2024-01-15T12:00:00',
    tempC: 22, // 72°F
    apparentC: 22, // 72°F
    rh: 40,
    uv: 4,
    windMps: 9, // ~20 mph
    gustMps: 9,
    precipPct: 0,
    weathercode: 0,
    cloud: 60
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(windyWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'good conditions'}`);
    console.log(`  wind sensitivity: ${profile.windSensitivity.toFixed(2)}`);
    console.log(`  size: ${profile.flags.toySized ? 'small (easier to blow over)' : 'medium/large'}\n`);
  });

  // Test 5: Perfect conditions - should show energy/endurance differences
  console.log('perfect conditions (70°F, 50% humidity):');
  const perfect = {
    timeISO: '2024-01-15T10:00:00',
    tempC: 21, // 70°F
    apparentC: 21, // 70°F
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
    const result = scoreHour(perfect, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ') || 'perfect conditions'}`);
    console.log(`  energy: ${profile.energyBand}`);
    console.log(`  endurance: ${profile.enduranceMinutes} min`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });
}

testBreedSensitivity();
