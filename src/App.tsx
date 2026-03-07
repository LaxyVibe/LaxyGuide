import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import POIListing from './pages/POIListing';
import POISearch from './pages/POISearch';
import POIDetail from './pages/POIDetail';
import GuideListing from './pages/GuideListing';
import AnalyticsTracker from './components/AnalyticsTracker';
import './App.css';

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
          <AnalyticsTracker />
          <Routes>
            <Route path="/" element={<GuideListing />} />
            <Route path="/:guideId" element={<Landing />} />
            <Route path="/:guideId/list" element={<POIListing />} />
            <Route path="/:guideId/search" element={<POISearch />} />
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
