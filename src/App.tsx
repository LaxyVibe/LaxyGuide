import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, useLocation, useParams } from 'react-router-dom';
import Landing from './pages/Landing';
import HubLanding from './pages/HubLanding';
import BasicInfo from './pages/BasicInfo';
import POIListing from './pages/POIListing';
import POISearch from './pages/POISearch';
import POIDetail from './pages/POIDetail';
import GuideMap from './pages/GuideMap';
import GuideMapCapture from './pages/GuideMapCapture';
import GuideMapDraw from './pages/GuideMapDraw';
import GuideListing from './pages/GuideListing';
import AnalyticsTracker from './components/AnalyticsTracker';
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

    const isHubGuide = activeGuideId === USAA_GUIDE_ID;
    document.body.classList.toggle(USAA_THEME_CLASS, isHubGuide);

    return () => {
      document.body.classList.remove(USAA_THEME_CLASS);
    };
  }, [location.pathname]);

  return null;
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
            <Route path="/:guideId/map/capture" element={<GuideMapCapture />} />
            <Route path="/:guideId/map/draw" element={<GuideMapDraw />} />
            <Route path="/:guideId/map" element={<GuideMap />} />
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
