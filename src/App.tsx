import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom';
import Landing from './pages/Landing';
import HubLanding from './pages/HubLanding';
import BasicInfo from './pages/BasicInfo';
import POIListing from './pages/POIListing';
import POISearch from './pages/POISearch';
import POIDetail from './pages/POIDetail';
import GuideMapDraw from './pages/GuideMapDraw';
import GuideMapView from './pages/GuideMapView';
import GuideListing from './pages/GuideListing';
import AnalyticsTracker from './components/AnalyticsTracker';
import { ensureFirebaseUser, getCurrentFirebaseUser, getMissingFirebaseConfigKeys, subscribeToFirebaseAuth } from './utils/firebaseAuth';
import './App.css';

const HUB_GUIDE_IDS = new Set(['JPN-USAA-TEM-001']);
const USAA_GUIDE_ID = 'JPN-USAA-TEM-001';
const USAA_THEME_CLASS = 'theme-guide-jpn-usaa-tem-001';

const GuideLandingGate: React.FC = () => {
  const { guideId } = useParams<{ guideId: string }>();
  const normalizedGuideId = guideId?.toUpperCase();

  if (normalizedGuideId && HUB_GUIDE_IDS.has(normalizedGuideId)) {
    return <HubLanding />;
  }

  return <Landing />;
};

const GuideThemeController: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const activeGuideId = parts[0] === 'hub'
      ? parts[1]?.toUpperCase()
      : parts[0]?.toUpperCase();
    const isDesktopAuthoringRoute = parts.length >= 3 && parts[1] === 'map' && parts[2] === 'draw';

    const isHubGuide = activeGuideId === USAA_GUIDE_ID;
    document.body.classList.toggle(USAA_THEME_CLASS, isHubGuide);
    document.body.classList.toggle('desktop-authoring-route', isDesktopAuthoringRoute);

    return () => {
      document.body.classList.remove(USAA_THEME_CLASS);
      document.body.classList.remove('desktop-authoring-route');
    };
  }, [location.pathname]);

  return null;
};

type DrawRouteAuthState = 'checking' | 'prompting' | 'blocked' | 'allowed';

const ProtectedGuideMapDrawRoute: React.FC = () => {
  const { guideId } = useParams<{ guideId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const promptAttemptedRef = useRef(false);
  const [authState, setAuthState] = useState<DrawRouteAuthState>('checking');
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const backToMapView = () => {
    const to = guideId ? `/${guideId}/map${location.search}` : '/';
    if ('startViewTransition' in document) {
      document.startViewTransition(() => navigate(to));
    } else {
      navigate(to);
    }
  };

  useEffect(() => {
    promptAttemptedRef.current = false;
    setAuthState('checking');
    setAuthMessage(null);
  }, [guideId, location.key]);

  useEffect(() => {
    const missingKeys = getMissingFirebaseConfigKeys();
    if (missingKeys.length > 0) {
      setAuthState('blocked');
      setAuthMessage(`Firebase auth is not configured: missing ${missingKeys.join(', ')}`);
      return () => undefined;
    }

    if (getCurrentFirebaseUser()) {
      setAuthState('allowed');
      setAuthMessage(null);
      return () => undefined;
    }

    return subscribeToFirebaseAuth((user) => {
      if (user) {
        setAuthState('allowed');
        setAuthMessage(null);
      }
    });
  }, [guideId]);

  useEffect(() => {
    let cancelled = false;
    const missingKeys = getMissingFirebaseConfigKeys();
    if (missingKeys.length > 0) {
      return () => {
        cancelled = true;
      };
    }

    if (authState !== 'checking' || promptAttemptedRef.current || getCurrentFirebaseUser()) {
      return;
    }

    promptAttemptedRef.current = true;
    setAuthState('prompting');
    setAuthMessage(null);

    ensureFirebaseUser()
      .then(() => {
        if (!cancelled) {
          setAuthState('allowed');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setAuthState('blocked');
        setAuthMessage(message || 'Sign-in was cancelled.');
      });

    return () => {
      cancelled = true;
    };
  }, [authState]);

  const handleRetry = () => {
    promptAttemptedRef.current = false;
    setAuthState('checking');
    setAuthMessage(null);
  };

  if (authState === 'allowed') {
    return <GuideMapDraw />;
  }

  if (authState === 'checking' || authState === 'prompting') {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <div style={{ maxWidth: 320, textAlign: 'center', color: 'var(--neutral-800)' }}>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>
            {authState === 'prompting' ? 'Opening sign-in…' : 'Checking access…'}
          </h1>
          <p style={{ margin: 0, color: 'var(--neutral-600)', lineHeight: 1.5 }}>
            Sign in with your Google account to open the map editor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, padding: 24, borderRadius: 20, background: 'rgba(245, 245, 245, 0.96)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)' }}>
        <h1 style={{ fontSize: 24, margin: '0 0 10px', color: 'var(--neutral-900)' }}>Sign-in required</h1>
        <p style={{ margin: 0, color: 'var(--neutral-700)', lineHeight: 1.5 }}>
          {authMessage || 'You need to sign in before entering the map editor.'}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={handleRetry}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 999,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Retry sign in
          </button>
          <button
            onClick={backToMapView}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 999,
              border: '1px solid rgba(15, 23, 42, 0.14)',
              background: '#fff',
              color: 'var(--neutral-800)',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Back to map
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [audioPlaying, setAudioPlaying] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const playing = (e as CustomEvent<{ isPlaying: boolean }>).detail.isPlaying;
      setAudioPlaying(playing);
      document.body.classList.toggle('audio-playing', playing);
    };
    document.addEventListener('audioPlayStateChange', handler);
    return () => document.removeEventListener('audioPlayStateChange', handler);
  }, []);

  // Check for Netlify Identity invite token to prevent redirect
  if (window.location.hash.includes('invite_token')) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <h1>Processing Invitation...</h1>
        <p>Please wait for the login window to appear.</p>
      </div>
    );
  }

  return (
    <>
      <div className="phone-shell">
        <Router>
          <GuideThemeController />
          <AnalyticsTracker />
          <Routes>
            <Route path="/" element={<GuideListing />} />
            <Route path="/:guideId" element={<GuideLandingGate />} />
            <Route path="/:guideId/basic-info" element={<BasicInfo />} />
            <Route path="/:guideId/list" element={<POIListing />} />
            <Route path="/:guideId/search" element={<POISearch />} />
            <Route path="/:guideId/map/draw" element={<ProtectedGuideMapDrawRoute />} />
            <Route path="/:guideId/map" element={<GuideMapView />} />
            <Route path="/:guideId/:poiId" element={<POIDetail />} />
          </Routes>
        </Router>
      </div>
      {createPortal(
        <div className={`desktop-ripples${audioPlaying ? ' active' : ''}`} aria-hidden="true">
          <span className="ripple ripple-1" />
          <span className="ripple ripple-2" />
          <span className="ripple ripple-3" />
          <span className="ripple ripple-4" />
        </div>,
        document.body
      )}
    </>
  );
}

export default App;
