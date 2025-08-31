// test the scoring that considers breed differences
import { buildBreedProfile } from '../src/breedProfiles.js';
import { scoreHour } from '../src/scoring.js';

// fake weather data for testing
const mockWeather = {
  timeISO: '2024-01-15T14:00:00',
  tempC: 25, // 77°F
  apparentC: 27, // 81°F
  rh: 65,
  uv: 7,
  windMps: 5, // ~11 mph
  gustMps: 8, // ~18 mph
  precipPct: 10,
  weathercode: 1,
  cloud: 20
};

const mockSun = {
  sunrise: new Date('2024-01-15T07:00:00'),
  sunset: new Date('2024-01-15T17:00:00')
};

// different dog breeds to test
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
  },
  chihuahua: {
    name: 'Chihuahua',
    breed_group: 'Toy',
    temperament: 'Devoted, Lively, Alert',
    height: { imperial: '6 - 9' },
    weight: { imperial: '3 - 6' }
  }
};

function runTests() {
  console.log('testing breed-aware scoring logic\n');

  // build breed profiles
  console.log('breed profile building:');
  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    console.log(`${name}:`);
    console.log(`  energy: ${profile.energyBand}`);
    console.log(`  endurance: ${profile.enduranceMinutes} min`);
    console.log(`  heat sensitivity: ${profile.heatSensitivity.toFixed(2)}`);
    console.log(`  cold sensitivity: ${profile.coldSensitivity.toFixed(2)}`);
    console.log(`  pavement sensitivity: ${profile.pavementSensitivity.toFixed(2)}`);
    console.log(`  flags: ${Object.entries(profile.flags).filter(([,v]) => v).map(([k]) => k).join(', ')}\n`);
  });

  // same weather, different breeds
  console.log('same weather, different breeds (77°F, 65% humidity, UV 7):');
  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(mockWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // hot weather
  console.log('hot weather impact (95°F, 80% humidity, UV 10):');
  const hotWeather = { ...mockWeather, tempC: 35, apparentC: 40, rh: 80, uv: 10 };
  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(hotWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // cold weather
  console.log('cold weather impact (20°F, 30% humidity, UV 2):');
  const coldWeather = { ...mockWeather, tempC: -7, apparentC: -10, rh: 30, uv: 2 };
  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(coldWeather, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });
}

// Run the tests
runTests();
