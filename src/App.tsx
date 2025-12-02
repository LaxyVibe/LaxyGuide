import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import Landing from './pages/Landing';
import POIListing from './pages/POIListing';
import POIDetail from './pages/POIDetail';
import './App.css';

const AdminRedirect = () => {
  useEffect(() => {
    window.location.href = '/admin/index.html';
  }, []);
  return null;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Handle /admin route explicitly to bypass SPA routing and load static admin page */}
        <Route path="/admin" element={<AdminRedirect />} />
        <Route path="/:guideId" element={<Landing />} />
        <Route path="/:guideId/list" element={<POIListing />} />
        <Route path="/:guideId/:poiId" element={<POIDetail />} />
        {/* Redirect root to a default guide or 404 */}
        <Route path="/" element={<Navigate to="/JPN-OITA-MUS-003" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
