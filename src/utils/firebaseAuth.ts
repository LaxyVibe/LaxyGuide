import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
    GoogleAuthProvider,
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    type Unsubscribe,
    type User
} from 'firebase/auth';

type FirebaseWebConfig = {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
};

const DEFAULT_FIREBASE_WEB_CONFIG: FirebaseWebConfig = {
    apiKey: 'AIzaSyA7V8lxX_z7nmuE-fGsFEIenzsBPDCNw64',
    authDomain: 'laxy-guide-dev.firebaseapp.com',
    projectId: 'laxy-guide-dev',
    storageBucket: 'laxy-guide-dev.firebasestorage.app',
    messagingSenderId: '434671355332',
    appId: '1:434671355332:web:7b9645abcc18f9c1fe5091'
};

function getFirebaseWebConfig(): FirebaseWebConfig {
    return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? DEFAULT_FIREBASE_WEB_CONFIG.apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? DEFAULT_FIREBASE_WEB_CONFIG.authDomain,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_WEB_CONFIG.projectId,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? DEFAULT_FIREBASE_WEB_CONFIG.storageBucket,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? DEFAULT_FIREBASE_WEB_CONFIG.messagingSenderId,
        appId: import.meta.env.VITE_FIREBASE_APP_ID ?? DEFAULT_FIREBASE_WEB_CONFIG.appId
    };
}

export function getMissingFirebaseConfigKeys(): string[] {
    const config = getFirebaseWebConfig();

    return Object.entries(config)
        .filter(([, value]) => !String(value).trim())
        .map(([key]) => key);
}

export function isFirebaseAuthConfigured(): boolean {
    return getMissingFirebaseConfigKeys().length === 0;
}

function getFirebaseAppInstance(): FirebaseApp {
    const missing = getMissingFirebaseConfigKeys();
    if (missing.length > 0) {
        throw new Error(`Firebase Auth is not configured: missing ${missing.join(', ')}`);
    }

    if (getApps().length > 0) {
        return getApp();
    }

    return initializeApp(getFirebaseWebConfig());
}

function getFirebaseAuthInstance() {
    return getAuth(getFirebaseAppInstance());
}

export function subscribeToFirebaseAuth(callback: (user: User | null) => void): Unsubscribe {
    if (!isFirebaseAuthConfigured()) {
        callback(null);
        return () => undefined;
    }

    return onAuthStateChanged(getFirebaseAuthInstance(), callback);
}

export async function ensureFirebaseUser(): Promise<User> {
    const auth = getFirebaseAuthInstance();
    if (auth.currentUser) {
        return auth.currentUser;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    return result.user;
}
