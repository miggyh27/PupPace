// extreme conditions where breed differences should be obvious
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

function testExtremeConditions() {
  console.log('extreme conditions - breed differences should be clear\n');

  // very hot and humid - pugs should struggle most
  console.log('very hot & humid (95°F, 85% humidity):');
  const veryHot = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 35, // 95°F
    apparentC: 42, // 108°F with humidity
    rh: 85,
    uv: 8,
    windMps: 2, // ~4 mph
    gustMps: 2,
    precipPct: 0,
    weathercode: 0,
    cloud: 5
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(veryHot, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
    console.log(`  heat sensitivity: ${profile.heatSensitivity.toFixed(2)}`);
    console.log(`  brachycephalic: ${profile.flags.brachycephalic ? 'yes' : 'no'}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // very cold - huskies should do best
  console.log('very cold (-10°F, 30% humidity):');
  const veryCold = {
    timeISO: '2024-01-15T08:00:00',
    tempC: -23, // -10°F
    apparentC: -28, // -18°F with wind chill
    rh: 30,
    uv: 1,
    windMps: 7, // ~16 mph
    gustMps: 7,
    precipPct: 0,
    weathercode: 0,
    cloud: 50
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(veryCold, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
    console.log(`  cold sensitivity: ${profile.coldSensitivity.toFixed(2)}`);
    console.log(`  double coat: ${profile.flags.doubleCoat ? 'yes' : 'no'}`);
    console.log(`  suggested: ${result.suggest.pace} · ${result.suggest.duration} min\n`);
  });

  // extremely hot pavement - small dogs should be penalized heavily
  console.log('extremely hot pavement (100°F air, UV 11):');
  const extremePavement = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 38, // 100°F
    apparentC: 40, // 104°F
    rh: 40,
    uv: 11,
    windMps: 1, // ~2 mph
    gustMps: 1,
    precipPct: 0,
    weathercode: 0,
    cloud: 0
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(extremePavement, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
    console.log(`  pavement sensitivity: ${profile.pavementSensitivity.toFixed(2)}`);
    console.log(`  height: ${profile.flags.toySized ? 'small (closer to ground)' : 'medium/large'}\n`);
  });

  // Test 4: Very windy (40 mph gusts) - small dogs should be affected more
  console.log('very windy (40 mph gusts):');
  const veryWindy = {
    timeISO: '2024-01-15T12:00:00',
    tempC: 20, // 68°F
    apparentC: 20, // 68°F
    rh: 40,
    uv: 4,
    windMps: 18, // ~40 mph
    gustMps: 18,
    precipPct: 0,
    weathercode: 0,
    cloud: 60
  };

  Object.entries(testBreeds).forEach(([name, breed]) => {
    const profile = buildBreedProfile(breed);
    const result = scoreHour(veryWindy, mockSun, profile);
    console.log(`${name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
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

testExtremeConditions();
