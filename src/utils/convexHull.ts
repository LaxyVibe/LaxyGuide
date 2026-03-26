export type LatLng = { lat: number; lng: number };

function cross(o: LatLng, a: LatLng, b: LatLng) {
    // Treat lng as X and lat as Y.
    return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
}

function uniquePoints(points: LatLng[]): LatLng[] {
    const seen = new Set<string>();
    const out: LatLng[] = [];
    for (const p of points) {
        const key = `${p.lat.toFixed(8)},${p.lng.toFixed(8)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
    }
    return out;
}

/**
 * Computes a convex hull (Andrew monotone chain) from lat/lng points.
 * Returns hull vertices in counter-clockwise order. Empty array if < 3 unique points.
 */
export function convexHullLatLng(points: LatLng[]): LatLng[] {
    const clean = uniquePoints(
        points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    );
    if (clean.length < 3) return [];

    const sorted = clean
        .slice()
        .sort((a, b) => (a.lng !== b.lng ? a.lng - b.lng : a.lat - b.lat));

    const lower: LatLng[] = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper: LatLng[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }

    // Concatenate lower and upper to get full hull.
    // Last point of each list is the starting point of the other list.
    lower.pop();
    upper.pop();
    const hull = lower.concat(upper);

    return hull.length >= 3 ? hull : [];
}
