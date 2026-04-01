// Test script to verify laxyURL is being passed through
const { getPOIsByType } = require('./src/utils/dataFetcher.js');
const { DEFAULT_CLIENT_ID, DEFAULT_SUITE_ID } = require('./src/config/constants.js');

const testLaxyURL = async () => {
  try {
    console.log('Testing laxyURL data fetching...');
    console.log(`Using client: ${DEFAULT_CLIENT_ID}, suite: ${DEFAULT_SUITE_ID}`);
    
    // Get attractions from discovered configuration
    const result = await getPOIsByType(DEFAULT_CLIENT_ID, DEFAULT_SUITE_ID, 'attraction', 'en');
    
    console.log('Number of attractions found:', result.pois.length);
    
    // Find the Suginoi Hotel POI that should have laxyURL
    const suginoiPOI = result.pois.find(poi => poi.slug === 'Suginoi-Hotel-Aqua-Garden');
    
    if (suginoiPOI) {
      console.log('Found Suginoi Hotel POI:');
      console.log('- Label:', suginoiPOI.label);
      console.log('- LaxyURL:', suginoiPOI.laxyURL);
      console.log('- Dial:', suginoiPOI.dial);
      
      if (suginoiPOI.laxyURL) {
        console.log('✅ SUCCESS: laxyURL is present!');
      } else {
        console.log('❌ FAIL: laxyURL is missing!');
      }
    } else {
      console.log('❌ FAIL: Suginoi Hotel POI not found!');
    }
    
    // Check Kaimonji Onsen for dial field
    const kaimonjiPOI = result.pois.find(poi => poi.slug === 'Kaimonji-Onsen');
    if (kaimonjiPOI) {
      console.log('\nFound Kaimonji Onsen POI:');
      console.log('- Label:', kaimonjiPOI.label);
      console.log('- Dial:', kaimonjiPOI.dial);
      
      if (kaimonjiPOI.dial) {
        console.log('✅ SUCCESS: dial field is present!');
      } else {
        console.log('❌ FAIL: dial field is missing!');
      }
    }
    
  } catch (error) {
    console.error('Error testing laxyURL:', error);
  }
};

testLaxyURL();
