import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import POIListing from './pages/POIListing';
import POIDetail from './pages/POIDetail';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
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
