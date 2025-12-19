import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import POIListing from './pages/POIListing';
import POISearch from './pages/POISearch';
import POIDetail from './pages/POIDetail';
import GuideListing from './pages/GuideListing';
import AnalyticsTracker from './components/AnalyticsTracker';
import './App.css';

function App() {
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
    <Router>
      <AnalyticsTracker />
      <Routes>
        <Route path="/" element={<GuideListing />} />
        <Route path="/:guideId" element={<Landing />} />
        <Route path="/:guideId/list" element={<POIListing />} />
        <Route path="/:guideId/search" element={<POISearch />} />
        <Route path="/:guideId/:poiId" element={<POIDetail />} />
        {/* Redirect root to a default guide or 404 */}
      </Routes>
    </Router>
  );
}

export default App;
