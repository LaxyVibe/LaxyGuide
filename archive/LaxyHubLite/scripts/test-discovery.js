#!/usr/bin/env node

/**
 * Test Suite Discovery
 * 
 * This script tests the suite discovery functionality for different clients
 * without actually fetching all the data.
 */

const https = require('https');

// Configuration
const API_BASE_URL = 'https://laxy-studio-strapi-c1d6d20cbc41.herokuapp.com';
const API_TOKEN = 'e67959c9c07282664a57013db7120c2d9993fb097f9bd28cde7e550e0eaff82845957f4b9d572c5a4c33813922a982c8442bb460dab88f3253b964cf59b8428f227cec012a832526060cd2511631c9c2bc7525bb4252c3c15377cd8bb6d45b88f0721bbf87752720c4cdfbe1e4551ef29108638e377e9d536127afdb571b1acb';

/**
 * Makes an HTTPS GET request
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Test suite discovery for a client
 */
async function testClientSuites(clientId) {
  const url = `${API_BASE_URL}/api/suites?filters[ownedBy][slug][$eq]=${clientId}&fields[0]=name&fields[1]=label`;
  
  console.log(`🔍 Testing client: ${clientId}`);
  
  try {
    const data = await makeRequest(url);
    const suites = data.data || [];
    
    if (suites.length === 0) {
      console.log(`  ❌ No suites found`);
      return false;
    }
    
    console.log(`  ✅ Found ${suites.length} suite(s):`);
    suites.forEach((suite, index) => {
      const prefix = index === 0 ? '  🎯' : '  📦';
      console.log(`${prefix} ${suite.name} (${suite.label || 'No label'})`);
    });
    
    if (suites.length > 1) {
      console.log(`  💡 Multiple suites available. Script would use: ${suites[0].name}`);
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const clientId = process.argv[2] || 'beppu-airbnb';
  
  console.log('🚀 Suite Discovery Test');
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);
  console.log(`🔑 Using API Token: ${API_TOKEN.substring(0, 20)}...\n`);
  
  if (process.argv[2]) {
    // Test specific client
    await testClientSuites(clientId);
  } else {
    // Test default client
    console.log('Testing default client (use: node test-discovery.js <client-id> to test others)\n');
    await testClientSuites(clientId);
  }
  
  console.log('\n✨ Test completed!');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}
