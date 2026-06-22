import { useEffect, useState } from 'react';
import { loadMapTileBundle, type ResolvedMapTileBundle } from '../utils/mapTileBundle';

interface UseMapTileBundleOptions {
    bundleUrl?: string;
    guideId?: string;
    mapPixelWidth?: number;
    mapPixelHeight?: number;
    mapTileMaxZoom?: number;
}

export function useMapTileBundle({
    bundleUrl,
    guideId,
    mapPixelWidth,
    mapPixelHeight,
    mapTileMaxZoom
}: UseMapTileBundleOptions) {
    const [bundle, setBundle] = useState<ResolvedMapTileBundle | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!bundleUrl || !guideId) {
            setBundle(null);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        loadMapTileBundle(bundleUrl, guideId, {
            mapPixelWidth,
            mapPixelHeight,
            mapTileMaxZoom
        })
            .then((resolved) => {
                if (cancelled) return;
                setBundle(resolved);
                setLoading(false);
            })
            .catch((nextError) => {
                if (cancelled) return;
                setBundle(null);
                setLoading(false);
                setError(nextError instanceof Error ? nextError.message : String(nextError));
            });

        return () => {
            cancelled = true;
        };
    }, [bundleUrl, guideId, mapPixelWidth, mapPixelHeight, mapTileMaxZoom]);

    return { bundle, loading, error };
}
