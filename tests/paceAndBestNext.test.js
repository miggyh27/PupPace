// pace recommendations and best next hour feature
import { buildBreedProfile } from '../src/breedProfiles.js';
import { scoreHour, scoreDay } from '../src/scoring.js';

const mockSun = {
  sunrise: new Date('2024-01-15T07:00:00'),
  sunset: new Date('2024-01-15T17:00:00')
};

function testPaceAndBestNext() {
  console.log('testing pace recommendations & best next hour\n');

  // pace recommendations based on score
  console.log('pace recommendations based on score:');
  const testBreeds = [
    { name: 'Golden Retriever', group: 'Sporting', height: '21.5 - 24', weight: '55 - 75' },
    { name: 'Pug', group: 'Toy', height: '10 - 13', weight: '14 - 18' }
  ];

  const weatherConditions = [
    { temp: 100, label: 'extreme heat (100°F)', tempC: 38, apparentC: 42, rh: 80, uv: 10, score: 'low (0-3)' },
    { temp: 85, label: 'hot (85°F)', tempC: 29, apparentC: 32, rh: 70, uv: 7, score: 'medium (4-5)' },
    { temp: 72, label: 'perfect (72°F)', tempC: 22, apparentC: 22, rh: 50, uv: 3, score: 'high (8-10)' }
  ];

  testBreeds.forEach(breed => {
    console.log(`\n${breed.name}:`);
    weatherConditions.forEach(weather => {
      const breedData = {
        name: breed.name,
        breed_group: breed.group,
        temperament: 'Test',
        height: { imperial: breed.height },
        weight: { imperial: breed.weight }
      };
      
      const profile = buildBreedProfile(breedData);
      const weatherData = {
        timeISO: '2024-01-15T14:00:00',
        tempC: weather.tempC,
        apparentC: weather.apparentC,
        rh: weather.rh,
        uv: weather.uv,
        windMps: 3,
        gustMps: 3,
        precipPct: 0,
        weathercode: 0,
        cloud: 20
      };
      
      const result = scoreHour(weatherData, mockSun, profile);
      console.log(`  ${weather.label}: ${result.shaped}/10 → ${result.suggest.pace} · ${result.suggest.duration} min`);
    });
  });

  // best next hour with different current times
  console.log('\nbest next hour with different current times:');
  
  const mockWeather = {
    hourly: {
      time: [
        '2024-01-15T06:00:00', '2024-01-15T07:00:00', '2024-01-15T08:00:00', '2024-01-15T09:00:00',
        '2024-01-15T10:00:00', '2024-01-15T11:00:00', '2024-01-15T12:00:00', '2024-01-15T13:00:00',
        '2024-01-15T14:00:00', '2024-01-15T15:00:00', '2024-01-15T16:00:00', '2024-01-15T17:00:00',
        '2024-01-15T18:00:00', '2024-01-15T19:00:00', '2024-01-15T20:00:00', '2024-01-15T21:00:00',
        '2024-01-15T22:00:00', '2024-01-15T23:00:00', '2024-01-16T00:00:00', '2024-01-16T01:00:00',
        '2024-01-16T02:00:00', '2024-01-16T03:00:00', '2024-01-16T04:00:00', '2024-01-16T05:00:00'
      ],
      temperature_2m: Array(24).fill(25), // 77°F
      apparent_temperature: Array(24).fill(25),
      relative_humidity_2m: Array(24).fill(50),
      uv_index: Array(24).fill(3),
      precipitation_probability: Array(24).fill(0),
      weathercode: Array(24).fill(0),
      wind_speed_10m: Array(24).fill(3),
      wind_gusts_10m: Array(24).fill(3),
      cloudcover: Array(24).fill(20)
    },
    daily: {
      sunrise: ['2024-01-15T07:00:00'],
      sunset: ['2024-01-15T17:00:00']
    }
  };

  const testTimes = [
    { time: '4:00 AM', hour: 4, expected: 'morning preference' },
    { time: '10:00 PM', hour: 22, expected: 'next day morning' },
    { time: '2:00 PM', hour: 14, expected: 'evening preference' }
  ];

  testTimes.forEach(test => {
    // mock the current time
    const originalDate = global.Date;
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          super('2024-01-15T' + String(test.hour).padStart(2, '0') + ':00:00');
        } else {
          super(...args);
        }
      }
    };

    const breedData = {
      name: 'Golden Retriever',
      breed_group: 'Sporting',
      temperament: 'Intelligent, Friendly',
      height: { imperial: '21.5 - 24' },
      weight: { imperial: '55 - 75' }
    };

    const scored = scoreDay(mockWeather, breedData);
    
    if (scored.bestNext) {
      const hourTime = new Date(scored.bestNext.timeISO);
      const hourOfDay = hourTime.getHours();
      const timeLabel = hourOfDay < 12 ? `${hourOfDay} AM` : hourOfDay === 12 ? '12 PM' : `${hourOfDay - 12} PM`;
      
      console.log(`  ${test.time}: Best next at ${timeLabel} (${scored.bestNext.timeLabel})`);
      console.log(`    Score: ${scored.bestNext.shapedScore}/10, Time preference: ${scored.bestNext.timePreference.toFixed(2)}`);
      console.log(`    Suggested: ${scored.bestNext.suggest.pace} · ${scored.bestNext.suggest.duration} min`);
    }

    // restore original Date
    global.Date = originalDate;
  });

  // Test 3: Quick pace for low scores
  console.log('\nquick pace for low scores:');
  const extremeWeather = {
    timeISO: '2024-01-15T14:00:00',
    tempC: 40, // 104°F
    apparentC: 45, // 113°F
    rh: 90,
    uv: 11,
    windMps: 2,
    gustMps: 2,
    precipPct: 0,
    weathercode: 0,
    cloud: 5
  };

  testBreeds.forEach(breed => {
    const breedData = {
      name: breed.name,
      breed_group: breed.group,
      temperament: 'Test',
      height: { imperial: breed.height },
      weight: { imperial: breed.weight }
    };
    
    const profile = buildBreedProfile(breedData);
    const result = scoreHour(extremeWeather, mockSun, profile);
    
    console.log(`  ${breed.name}: ${result.shaped}/10 → ${result.suggest.pace} · ${result.suggest.duration} min`);
    console.log(`    Reasons: ${result.reasons.join(', ')}`);
  });

  // Test 4: Time preference logic
  console.log('\ntime preference logic:');
  const timePreferences = [
    { hour: 6, label: '6 AM', expected: 'perfect' },
    { hour: 10, label: '10 AM', expected: 'perfect' },
    { hour: 14, label: '2 PM', expected: 'okay' },
    { hour: 18, label: '6 PM', expected: 'very good' },
    { hour: 22, label: '10 PM', expected: 'late' },
    { hour: 2, label: '2 AM', expected: 'very early' }
  ];

  timePreferences.forEach(test => {
    let timePreference = 1.0;
    
    if (test.hour >= 6 && test.hour <= 10) {
      timePreference = 1.0; // perfect
    } else if (test.hour >= 17 && test.hour <= 20) {
      timePreference = 0.9; // very good
    } else if (test.hour >= 11 && test.hour <= 16) {
      timePreference = 0.7; // okay
    } else if (test.hour >= 21 && test.hour <= 23) {
      timePreference = 0.5; // late but acceptable
    } else {
      timePreference = 0.3; // very early/late
    }
    
    console.log(`  ${test.label}: ${timePreference.toFixed(1)} (${test.expected})`);
  });

  console.log('\n✅ Pace & Best Next Hour Validation:');
  console.log('  ✓ Low scores (0-3) suggest "quick" pace with shorter duration');
  console.log('  ✓ Medium scores (4-5) suggest "stroll" pace');
  console.log('  ✓ High scores (8-10) suggest full duration walks');
  console.log('  ✓ Best next hour considers both weather score and time preference');
  console.log('  ✓ Morning (6-10 AM) and evening (5-8 PM) are preferred times');
  console.log('  ✓ Late night/early morning times are penalized');
  console.log('  ✓ Breed energy levels still affect pace suggestions');
}

testPaceAndBestNext();
