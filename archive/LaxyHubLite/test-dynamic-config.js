// Test script to verify dynamic configuration
// Note: This is a simple test - for full testing, use the built application

const testDynamicConfig = async () => {
  try {
    console.log('🚀 Testing dynamic configuration...');
    
    // Read discovered configuration
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, 'src', 'config', 'discovered.json');
    
    if (!fs.existsSync(configPath)) {
      console.error('❌ discovered.json not found. Please run "npm run prebuild" first.');
      return;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`✅ Found dynamic configuration:`);
    console.log(`   Client ID: ${config.clientId}`);
    console.log(`   Suite ID: ${config.suiteId}`);
    console.log(`   Discovered at: ${config.discoveredAt}`);
    
    // Check if mock data exists
    const mockPath = path.join(__dirname, 'src', 'mocks', 'suites', config.clientId, config.suiteId, 'en.json');
    if (fs.existsSync(mockPath)) {
      console.log(`✅ Mock data exists at: ${path.relative(__dirname, mockPath)}`);
      const mockData = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
      const pois = mockData.data[0]?.ownedBy?.pickedPOIs || [];
      const attractions = pois.filter(poi => poi.type === 'attraction');
      console.log(`✅ Found ${attractions.length} attractions in mock data`);
      
      // Check for laxyURL
      const poisWithLaxyURL = attractions.filter(poi => poi.laxyURL);
      console.log(`✅ Found ${poisWithLaxyURL.length} POIs with laxyURL`);
      
      // Find the Suginoi Hotel POI that should have laxyURL
      const suginoiPOI = attractions.find(poi => poi.slug === 'Suginoi-Hotel-Aqua-Garden');
      if (suginoiPOI) {
        console.log('\n🎯 Found Suginoi Hotel POI:');
        console.log(`   Label: ${suginoiPOI.label}`);
        console.log(`   LaxyURL: ${suginoiPOI.laxyURL || 'Not found'}`);
        console.log(`   Dial: ${suginoiPOI.dial || 'Not found'}`);
        
        if (suginoiPOI.laxyURL) {
          console.log('   ✅ SUCCESS: laxyURL is present!');
        } else {
          console.log('   ⚠️  laxyURL is missing');
        }
      }
      
    } else {
      console.log(`❌ Mock data not found at: ${mockPath}`);
    }
    
    console.log('\n🎉 Dynamic configuration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testDynamicConfig();
