// edge cases and stuff that could be improved
import { buildBreedProfile } from '../src/breedProfiles.js';
import { scoreHour } from '../src/scoring.js';

const mockSun = {
  sunrise: new Date('2024-01-15T07:00:00'),
  sunset: new Date('2024-01-15T17:00:00')
};

function testEdgeCases() {
  console.log('testing edge cases\n');

  // unknown/mixed breeds
  console.log('unknown/mixed breeds:');
  const unknownBreed = {
    name: 'Mixed Breed',
    breed_group: 'Mixed',
    temperament: 'Unknown',
    height: { imperial: '18 - 22' },
    weight: { imperial: '30 - 50' }
  };
  
  const profile = buildBreedProfile(unknownBreed);
  console.log(`  mixed breed profile:`);
  console.log(`    energy: ${profile.energyBand} | endurance: ${profile.enduranceMinutes} min`);
  console.log(`    heat: ${profile.heatSensitivity.toFixed(2)} | cold: ${profile.coldSensitivity.toFixed(2)}`);
  console.log(`    traits: ${Object.entries(profile.flags).filter(([,v]) => v).map(([k]) => k).join(', ') || 'none'}`);
  console.log('');

  // extreme weather
  console.log('extreme weather:');
  const extremeWeather = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 45, // 113°F
    apparentC: 50, // 122°F
    rh: 95,
    uv: 11,
    windMps: 20, // ~45 mph
    gustMps: 25, // ~56 mph
    precipPct: 90,
    weathercode: 95, // thunderstorm
    cloud: 0
  };

  const testBreeds = ['goldenRetriever', 'husky', 'pug'].map(name => ({
    name,
    breed_group: name === 'husky' ? 'Working' : name === 'goldenRetriever' ? 'Sporting' : 'Toy',
    temperament: 'Test',
    height: { imperial: name === 'pug' ? '10 - 13' : '20 - 24' },
    weight: { imperial: name === 'pug' ? '14 - 18' : '50 - 70' }
  }));

  testBreeds.forEach(breed => {
    const prof = buildBreedProfile(breed);
    const result = scoreHour(extremeWeather, mockSun, prof);
    console.log(`  ${breed.name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
    console.log(`    suggested: ${result.suggest.pace} · ${result.suggest.duration} min`);
  });
  console.log('');

  // missing weather data
  console.log('missing weather data:');
  const incompleteWeather = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 25, // 77°F
    apparentC: null, // missing
    rh: null, // missing
    uv: 5,
    windMps: 5,
    gustMps: null, // missing
    precipPct: 0,
    weathercode: 0,
    cloud: 50
  };

  const testBreed = {
    name: 'Golden Retriever',
    breed_group: 'Sporting',
    temperament: 'Intelligent, Friendly',
    height: { imperial: '21.5 - 24' },
    weight: { imperial: '55 - 75' }
  };

  const prof = buildBreedProfile(testBreed);
  const result = scoreHour(incompleteWeather, mockSun, prof);
  console.log(`  golden retriever with missing data: ${result.shaped}/10 - ${result.reasons.join(', ') || 'good conditions'}`);
  console.log('');

  // night time
  console.log('night time:');
  const nightWeather = {
    timeISO: '2024-01-15T23:00:00', // 11 PM
    tempC: 15, // 59°F
    apparentC: 15,
    rh: 60,
    uv: 0,
    windMps: 3,
    gustMps: 3,
    precipPct: 0,
    weathercode: 0,
    cloud: 80
  };

  const nightResult = scoreHour(nightWeather, mockSun, prof);
  console.log(`  night walk: ${nightResult.shaped}/10 - ${nightResult.reasons.join(', ')}`);
  console.log('');

  // size extremes
  console.log('size extremes:');
  const tinyDog = {
    name: 'Chihuahua',
    breed_group: 'Toy',
    temperament: 'Test',
    height: { imperial: '6 - 9' },
    weight: { imperial: '3 - 6' }
  };

  const hugeDog = {
    name: 'Great Dane',
    breed_group: 'Working',
    temperament: 'Test',
    height: { imperial: '28 - 32' },
    weight: { imperial: '110 - 175' }
  };

  const moderateWeather = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 25, // 77°F
    apparentC: 27, // 81°F
    rh: 60,
    uv: 6,
    windMps: 8, // ~18 mph
    gustMps: 10, // ~22 mph
    precipPct: 0,
    weathercode: 0,
    cloud: 30
  };

  [tinyDog, hugeDog].forEach(breed => {
    const prof = buildBreedProfile(breed);
    const result = scoreHour(moderateWeather, mockSun, prof);
    console.log(`  ${breed.name}: ${result.shaped}/10 - ${result.reasons.join(', ')}`);
  });
  console.log('');

  console.log('potential improvements:');
  console.log('  - age factor (puppies/seniors)');
  console.log('  - health conditions (arthritis, heart issues)');
  console.log('  - coat length/thickness variations');
  console.log('  - individual dog preferences');
  console.log('  - local terrain (hills, pavement vs grass)');
  console.log('  - time of year adjustments');
  console.log('  - user calibration ("my dog runs hot/cold")');
}

testEdgeCases();
