import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Landing from './pages/Landing';
import POIListing from './pages/POIListing';
import POISearch from './pages/POISearch';
import POIDetail from './pages/POIDetail';
import AnalyticsTracker from './components/AnalyticsTracker';
import './App.css';

const AdminRedirect = () => {
  useEffect(() => {
    window.location.href = '/laxy-admin/index.html';
  }, []);
  return null;
};

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
        {/* Handle /admin route explicitly to bypass SPA routing and load static admin page */}
        <Route path="/laxy-admin" element={<AdminRedirect />} />
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
