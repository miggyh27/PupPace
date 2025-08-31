# PupPace Test Suite

Tests to make sure the breed-aware scoring works right for different dogs and weather.

## Test Files

### `breedScoring.test.js`
Main test suite that covers:
- Building breed profiles
- Same weather, different breeds
- Hot weather impact
- Cold weather impact
- Extreme conditions
- Windy conditions
- Perfect conditions

### `breedComparison.test.js`
Shows how different breeds handle:
- Moderate heat (85°F, 70% humidity)
- Cold weather (15°F, 40% humidity)
- Hot pavement (90°F air, high UV)
- Perfect conditions (72°F, 50% humidity)
- Windy conditions (75°F, 30 mph gusts)

### `extremeConditions.test.js`
Tests really bad weather:
- Very hot and humid (95°F, 85% humidity)
- Very cold (-10°F, 30% humidity)
- Extremely hot pavement (100°F air, UV 11)
- Very windy (40 mph gusts)
- Perfect conditions (70°F, 50% humidity)

### `breedSensitivity.test.js`
Tests how sensitive different breeds are to:
- Warm weather (80°F, 70% humidity)
- Cool weather (25°F, 40% humidity)
- Hot pavement (85°F air, UV 8)
- Windy weather (20 mph gusts)
- Perfect conditions (70°F, 50% humidity)

### `summary.test.js`
Quick overview showing:
- Breed profiles and traits
- Hot summer day scenario
- Cold winter morning scenario
- Perfect spring day scenario
- Logic validation checklist

### `coldWeatherTest.js`
Tests cold weather advantages:
- Various cold temperatures (20°F to -10°F)
- Husky cold weather bonuses
- Small dog cold penalties
- Perfect husky weather conditions

### `hotWeatherTest.js`
Tests hot weather penalties:
- Various hot temperatures (80°F to 95°F)
- Brachycephalic heat penalties
- Double coat heat sensitivity
- Extreme hot weather conditions

### `edgeCases.test.js`
Tests edge cases and improvements:
- Unknown/mixed breeds
- Extreme weather conditions
- Missing weather data
- Night time conditions
- Size extremes (tiny vs giant breeds)
- Potential configurable parameters

### `dataDependency.test.js`
Tests data dependency:
- Different breeds get different scores for same weather
- Same breed gets different scores for different weather
- Breed traits affect scoring
- All API data fields are used
- No hardcoded breed-specific scores

### `paceAndBestNext.test.js`
Tests pace recommendations and best next hour:
- Pace recommendations based on score (quick/stroll/brisk)
- Best next hour considering current time and preferences
- Time preference logic (morning/evening preferred)
- Quick pace for low scores with shorter duration
- Music tempo mapping for different paces

### `uiTest.js`
Tests UI data flow and best next hour:
- scoreDay function returns bestNext data
- processWeatherData includes bestNext in output
- bestNext has all required fields (time, score, suggest, etc.)
- Time preference logic works correctly
- Best next hour considers current time

### `uiLayout.test.js`
Tests UI layout improvements:
- Container width increased from 480px to 800px
- Grid uses 2 columns on desktop, 1 column on mobile
- Best next walk section is properly separated
- Enhanced styling for best next walk card
- Responsive design maintained for mobile

## Running Tests

Run individual tests:
```bash
node tests/breedScoring.test.js
node tests/summary.test.js
node tests/coldWeatherTest.js
```

Run all tests:
```bash
for file in tests/*.test.js; do
  echo "=== $file ==="
  node "$file"
  echo ""
done
```

## What the Tests Check

### Breed Differences
- Pugs struggle in heat due to brachycephalic traits
- Huskies excel in cold due to double coat
- Small dogs are more sensitive to pavement heat and wind
- Golden retrievers are well-balanced

### Weather Scoring
- Scores reflect actual weather conditions
- Breed-specific penalties and bonuses are applied
- Reason chips explain why scores are what they are
- No hardcoded breed-specific scores

### Pace Recommendations
- Low scores suggest "quick" pace with shorter duration
- High scores suggest "brisk" or "stroll" based on breed energy
- Duration adjusts based on weather conditions
- Extreme weather reduces walk duration

### Best Next Hour
- Considers current time and user preferences
- Morning and evening hours are preferred
- Late night and very early morning are penalized
- Returns the best upcoming walk time

### UI Integration
- Best next hour data flows correctly to UI
- Layout improvements work on desktop and mobile
- Reason chips and suggestions display properly
- XSS protection is in place

## Expected Results

When tests pass, you should see:
- Different breeds getting different scores for same weather
- Same breed getting different scores for different weather
- Breed traits affecting scoring (brachy, double coat, size, etc.)
- All weather API fields being used in calculations
- No hardcoded breed-specific scores
- Everything depending on actual data from APIs
