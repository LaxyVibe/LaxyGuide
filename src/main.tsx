import './polyfills';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import App from './App.tsx'
import ReactGA from 'react-ga4';

// Fix mobile URL toolbar / 100vh issues by providing a CSS variable `--vh`
// This sets `--vh` to 1% of the window.innerHeight and updates on resize/orientation.
// On desktop (phone-frame mode), `--vh` reflects the phone frame height
// and `--phone-scale` provides a uniform zoom factor so the frame fits the viewport.
const PHONE_W = 393;
const PHONE_H = 852;
const PHONE_BEZEL = 26; // bezel thickness from box-shadow outsets

function setVh() {
  if (typeof window === 'undefined' || !window?.innerHeight) return;

  const isDesktop = window.matchMedia('(min-width: 769px)').matches;

  if (isDesktop) {
    // Scale so the phone + bezel fits comfortably within the viewport
    const availW = window.innerWidth * 0.85;
    const availH = window.innerHeight * 0.92;
    const scale = Math.min(1, availW / (PHONE_W + PHONE_BEZEL), availH / (PHONE_H + PHONE_BEZEL));
    document.documentElement.style.setProperty('--phone-scale', String(scale));

    // --vh based on the fixed phone frame height so all calc(var(--vh)*N)
    // references resolve relative to the phone, not the browser viewport
    document.documentElement.style.setProperty('--vh', `${PHONE_H * 0.01}px`);
  } else {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.removeProperty('--phone-scale');
  }
}

ReactGA.initialize("G-Z16JEM2EY8");

setVh()
window.addEventListener('resize', setVh, { passive: true })
window.addEventListener('orientationchange', setVh, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
