const DEFAULT_FIREBASE_WEB_CONFIG = {
  apiKey: 'AIzaSyA7V8lxX_z7nmuE-fGsFEIenzsBPDCNw64',
  authDomain: 'laxy-guide-dev.firebaseapp.com',
  projectId: 'laxy-guide-dev',
  storageBucket: 'laxy-guide-dev.firebasestorage.app',
  messagingSenderId: '434671355332',
  appId: '1:434671355332:web:7b9645abcc18f9c1fe5091'
};

function getFirebaseWebConfig(env = process.env) {
  return {
    apiKey: String(env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_WEB_CONFIG.apiKey),
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_WEB_CONFIG.authDomain),
    projectId: String(env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_WEB_CONFIG.projectId),
    storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_WEB_CONFIG.storageBucket),
    messagingSenderId: String(env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_WEB_CONFIG.messagingSenderId),
    appId: String(env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_WEB_CONFIG.appId)
  };
}

function createHandler(options = {}) {
  const env = options.env || process.env;

  return async (event = {}) => {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify(getFirebaseWebConfig(env))
    };
  };
}

exports.DEFAULT_FIREBASE_WEB_CONFIG = DEFAULT_FIREBASE_WEB_CONFIG;
exports.createHandler = createHandler;
exports.getFirebaseWebConfig = getFirebaseWebConfig;
exports.handler = createHandler();
