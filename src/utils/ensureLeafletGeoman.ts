import * as L from 'leaflet';

let loadPromise: Promise<void> | null = null;

function getMutableLeafletGlobal() {
    if (typeof window === 'undefined') return null;

    const existing = (window as any).L;
    if (existing && typeof existing === 'object') {
        return existing;
    }

    // `import * as L from 'leaflet'` is an ESM module namespace object.
    // In production builds it is non-extensible, but Leaflet-Geoman mutates
    // the Leaflet namespace by assigning `L.PM = ...`. Give the plugin a
    // mutable object that still points at the same Leaflet classes/functions.
    const mutableLeaflet = { ...L } as typeof L & Record<string, unknown>;
    (window as any).L = mutableLeaflet;
    return mutableLeaflet;
}

/**
 * Leaflet-Geoman ships in a form that expects a global `L`.
 * Under Vite/Esm we must set `window.L` before importing it.
 */
export async function ensureLeafletGeomanLoaded(): Promise<void> {
    if (typeof window === 'undefined') return;

    const globalLeaflet = getMutableLeafletGlobal();
    if (!globalLeaflet) return;

    // If PM is already present on the mutable global, plugin is loaded.
    if ((globalLeaflet as any)?.PM || (globalLeaflet as any)?.pm) return;

    if (!loadPromise) {
        loadPromise = (async () => {
            await import('@geoman-io/leaflet-geoman-free');
        })();
    }

    await loadPromise;
}
