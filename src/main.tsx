import './polyfills';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'
import ReactGA from 'react-ga4';

// Fix mobile URL toolbar / 100vh issues by providing a CSS variable `--vh`
// This sets `--vh` to 1% of the window.innerHeight and updates on resize/orientation
function setVh() {
  if (typeof window === 'undefined' || !window?.innerHeight) return
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
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
