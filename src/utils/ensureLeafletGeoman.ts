import * as L from 'leaflet';

let loadPromise: Promise<void> | null = null;

/**
 * Leaflet-Geoman ships in a form that expects a global `L`.
 * Under Vite/Esm we must set `window.L` before importing it.
 */
export async function ensureLeafletGeomanLoaded(): Promise<void> {
    if (typeof window === 'undefined') return;

    // If PM is already present, plugin is loaded.
    if ((L as any)?.PM || (L as any)?.pm) return;

    if (!loadPromise) {
        loadPromise = (async () => {
            (window as any).L = L;
            await import('@geoman-io/leaflet-geoman-free');
        })();
    }

    await loadPromise;
}
