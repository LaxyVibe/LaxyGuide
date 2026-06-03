import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapViewer, { type MapViewerHandle } from '../components/MapViewer';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import { transformLatLngToNormalized } from '../utils/geoTransform';
import { loadCalibrationFromLocalStorage, loadTraversableRegionsFromLocalStorage } from '../utils/mapDrawData';
import { downloadCloudBundle, listCloudBundles } from '../utils/cloudinaryCapture';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import { parseCaptureBundle } from '../utils/mapCaptureBundle';
import type { GeoCalibration, MapPin, MapPinsFile, POI, TraversableRegion } from '../types';
import { fetchPinsFile, findNearestPin, loadPinsFromLocalStorage } from '../utils/mapPins';
import { clampPointToTraversableRegions, hasTraversableRegions, isPointInsideTraversableRegions } from '../utils/traversableRegions';

const TARGET_GUIDE_ID = 'JPN-USAA-TEM-001';
const TARGET_BUNDLE_LABEL = '0528-sun-demo / 2026-05-28T04-04-59-537Z';
const LOCAL_DEV_BUNDLE_URL = '/bundles/JPN-USAA-TEM-001/bundle.zip';

const truncateSummary = (text: string, maxChars = 100): string => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
};

const GuideMap: React.FC = () => {
    const { guideId } = useParams<{ guideId: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const defaultLang = ensureLanguageParam(searchParams);
        if (defaultLang) {
            setSearchParams(setLanguageInQuery(searchParams, defaultLang), { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const lang = getLanguageFromQuery(searchParams);
    const { t, loading: transLoading } = useTranslation(lang);

    const { data, loading: guideLoading, error } = useGuideData(guideId, lang);
    const [pins, setPins] = useState<MapPin[]>([]);
    const [geoCalibration, setGeoCalibration] = useState<GeoCalibration | null>(null);
    const [traversableRegions, setTraversableRegions] = useState<TraversableRegion[]>([]);
    const [pinsError, setPinsError] = useState<string | null>(null);
    const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
    const [mapImageOverride, setMapImageOverride] = useState<string | null>(null);
    const [focusedPinId, setFocusedPinId] = useState<string | null>(null);
    const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
    const [cloudInitStatus, setCloudInitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [cloudInitError, setCloudInitError] = useState<string | null>(null);
    const mapRef = React.useRef<MapViewerHandle | null>(null);
    const isCloudForcedGuide = (guideId ?? '').toUpperCase() === TARGET_GUIDE_ID;
    const isLocalDevHost = typeof window !== 'undefined'
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const useLocalBundleForForcedGuide = isCloudForcedGuide && isLocalDevHost;

    useEffect(() => {
        let cancelled = false;

        const bootstrapCloudBundle = async () => {
            if (!guideId) {
                setCloudInitStatus('idle');
                setCloudInitError(null);
                return;
            }

            if (!isCloudForcedGuide) {
                setCloudInitStatus('success');
                setCloudInitError(null);
                return;
            }

            setCloudInitStatus('loading');
            setCloudInitError(null);
            setPinsError(null);

            try {
                if (useLocalBundleForForcedGuide) {
                    const resp = await fetch(LOCAL_DEV_BUNDLE_URL, { cache: 'no-store' });
                    if (!resp.ok) {
                        throw new Error(`Local bundle not found at ${LOCAL_DEV_BUNDLE_URL}`);
                    }

                    const bundleBlob = await resp.blob();
                    const parsed = await parseCaptureBundle(bundleBlob, guideId);
                    if (cancelled) return;

                    setPins(parsed.pinsFile.pins ?? []);
                    // Keep base map from guide content so tiled map can remain active on localhost.
                    setMapImageOverride(null);
                    setCloudInitStatus('success');
                    return;
                }

                const bundles = await listCloudBundles(guideId);
                const target = bundles.find((bundle) => {
                    const label = `${bundle.saveName} / ${bundle.createdAt}`;
                    return label === TARGET_BUNDLE_LABEL;
                });

                if (!target) {
                    throw new Error(`Required cloud bundle not found: ${TARGET_BUNDLE_LABEL}`);
                }

                const bundleBlob = await downloadCloudBundle(target.secureUrl, {
                    publicId: target.publicId,
                    format: target.format
                });
                const parsed = await parseCaptureBundle(bundleBlob, guideId);
                if (!parsed.imageDataUrl) {
                    throw new Error('Selected cloud bundle has no map image.');
                }

                if (cancelled) return;
                setPins(parsed.pinsFile.pins ?? []);
                // Keep guide base map so deployed map page can use tiled map after bundle pins load.
                setMapImageOverride(null);
                setCloudInitStatus('success');
            } catch (e) {
                if (cancelled) return;
                const message = e instanceof Error ? e.message : String(e);
                setPins([]);
                setMapImageOverride(null);
                setCloudInitError(message);
                setCloudInitStatus('error');
                console.error('GuideMap cloud bundle bootstrap failed', {
                    guideId,
                    localBundleUrl: useLocalBundleForForcedGuide ? LOCAL_DEV_BUNDLE_URL : null,
                    expectedBundleLabel: TARGET_BUNDLE_LABEL,
                    error: message
                });
            }
        };

        bootstrapCloudBundle();
        return () => {
            cancelled = true;
        };
    }, [guideId, isCloudForcedGuide, useLocalBundleForForcedGuide]);

    useEffect(() => {
        if (isCloudForcedGuide) {
            setMapImageOverride(null);
            return;
        }

        if (!guideId) {
            setMapImageOverride(null);
            return;
        }

        try {
            const raw = localStorage.getItem(`mapImageOverride:${guideId}`);
            if (raw && raw.startsWith('data:image/')) {
                setMapImageOverride(raw);
            } else {
                setMapImageOverride(null);
            }
        } catch {
            setMapImageOverride(null);
        }
    }, [guideId, isCloudForcedGuide]);

    useEffect(() => {
        if (!guideId) {
            setGeoCalibration(data?.geoCalibration ?? null);
            setTraversableRegions([]);
            return;
        }

        setGeoCalibration(loadCalibrationFromLocalStorage(guideId) ?? data?.geoCalibration ?? null);
        setTraversableRegions(loadTraversableRegionsFromLocalStorage(guideId)?.regions ?? []);
    }, [guideId, data?.geoCalibration]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setPinsError(null);
            if (!guideId) return;
            if (isCloudForcedGuide) return;

            const local = loadPinsFromLocalStorage(guideId);
            if (local && local.pins.length > 0) {
                setPins(local.pins);
                return;
            }

            const url = data?.mapPinsUrl;
            if (!url) {
                setPins([]);
                return;
            }

            try {
                const file: MapPinsFile = await fetchPinsFile(url);
                if (!cancelled) setPins(file.pins ?? []);
            } catch (e) {
                if (!cancelled) {
                    setPins([]);
                    setPinsError(e instanceof Error ? e.message : String(e));
                }
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [guideId, data?.mapPinsUrl, isCloudForcedGuide]);

    useEffect(() => {
        if (!locationTrackingEnabled) return;
        if (!('geolocation' in navigator)) return;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => {
                setHere(null);
            },
            { enableHighAccuracy: true, maximumAge: 2000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [locationTrackingEnabled]);

    const displayedHere = useMemo(() => {
        if (!here) return null;
        if (!hasTraversableRegions(traversableRegions)) return here;
        if (isPointInsideTraversableRegions(here, traversableRegions)) return here;
        return clampPointToTraversableRegions(here, traversableRegions) ?? here;
    }, [here, traversableRegions]);

    const nearest = useMemo(() => {
        if (!displayedHere || pins.length === 0) return null;
        return findNearestPin(pins, displayedHere);
    }, [displayedHere, pins]);

    const focusedPin = useMemo(() => {
        if (!focusedPinId) return null;
        return pins.find((pin) => pin.id === focusedPinId) ?? null;
    }, [focusedPinId, pins]);

    const poiByNumber = useMemo(() => {
        const byNumber = new Map<string, POI>();
        for (const poi of data?.pois ?? []) {
            byNumber.set(poi.number, poi);
        }
        return byNumber;
    }, [data]);

    const focusedPoi = useMemo(() => {
        if (!focusedPin) return null;
        return poiByNumber.get(focusedPin.id) ?? null;
    }, [focusedPin, poiByNumber]);

    const pinDisplayNameById = useMemo(() => {
        const out: Record<string, string> = {};
        for (const pin of pins) {
            out[pin.id] = poiByNumber.get(pin.id)?.title || pin.id;
        }
        return out;
    }, [pins, poiByNumber]);

    const displayedHerePoint = useMemo(() => {
        if (!displayedHere || !geoCalibration) return null;
        const normalized = transformLatLngToNormalized(geoCalibration.transform, displayedHere);
        if (!normalized || !Number.isFinite(normalized.x) || !Number.isFinite(normalized.y)) return null;
        return {
            x: Math.max(0, Math.min(1, normalized.x)),
            y: Math.max(0, Math.min(1, normalized.y))
        };
    }, [displayedHere, geoCalibration]);

    const handlePinFocus = React.useCallback(
        (pinId: string) => {
            setFocusedPinId(pinId);
            const target = pins.find((pin) => pin.id === pinId);
            if (target) {
                mapRef.current?.centerOnPoint(
                    { x: target.x, y: target.y },
                    {
                        yOffsetPx: 28
                    }
                );
            }
        },
        [pins]
    );

    const handleMapClick = React.useCallback(() => {
        setFocusedPinId(null);
    }, []);

    const handleRequestCurrentLocation = React.useCallback(() => {
        if (!('geolocation' in navigator)) {
            window.alert(t('map.locationDenied'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationTrackingEnabled(true);
            },
            () => {
                window.alert(t('map.locationDenied'));
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
        );
    }, [t]);

    const mapImage = isCloudForcedGuide
        ? (mapImageOverride || data?.mapImage)
        : (mapImageOverride || data?.mapImage);
    const shouldDisableTiles = !!mapImageOverride;
    const mapTileUrlTemplate = shouldDisableTiles ? undefined : data?.mapTileUrlTemplate;
    const mapTileMaxZoom = shouldDisableTiles ? undefined : data?.mapTileMaxZoom;
    const mapPixelWidth = shouldDisableTiles ? undefined : data?.mapPixelWidth;
    const mapPixelHeight = shouldDisableTiles ? undefined : data?.mapPixelHeight;

    if (transLoading || guideLoading || (isCloudForcedGuide && (cloudInitStatus === 'idle' || cloudInitStatus === 'loading'))) {
        return <Loading />;
    }
    if (error) return <div>{t('common.error')}: {error}</div>;

    const handleSwapToCapture = () => {
        const to = guideId ? `/${guideId}/map/capture?${searchParams.toString()}` : `/?${searchParams.toString()}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => {
                navigate(to);
            });
        } else {
            navigate(to);
        }
    };

    const handleBackToGuideLanding = () => {
        const to = guideId ? `/${guideId}?${searchParams.toString()}` : `/?${searchParams.toString()}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => {
                navigate(to);
            });
        } else {
            navigate(to);
        }
    };

    return (
        <div className="page">
            <GlobalHeader
                title={t('map.title')}
                showBack={false}
                showVersion={false}
                style={{
                    background: 'var(--neutral-100)',
                    borderBottom: 'none'
                }}
                leftSlot={
                    <button
                        onClick={handleBackToGuideLanding}
                        aria-label="Back"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--neutral-800)',
                            fontSize: 38,
                            lineHeight: 1,
                            fontWeight: 400,
                            cursor: 'pointer',
                            padding: 0,
                            width: 44,
                            height: 44
                        }}
                    >
                        <span aria-hidden="true">←</span>
                    </button>
                }
                rightSlot={
                    <button
                        onClick={handleRequestCurrentLocation}
                        aria-label="現在地"
                        title="現在地"
                        style={{
                            height: 56,
                            minWidth: 146,
                            borderRadius: 999,
                            border: 'none',
                            background: '#E43216',
                            color: 'rgba(245, 245, 245, 0.98)',
                            fontWeight: 900,
                            fontSize: 18,
                            padding: '0 24px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 0 rgba(0, 0, 0, 0.08)'
                        }}
                    >
                        現在地
                    </button>
                }
            />
            <div
                className="scroll-content"
                style={{
                    position: 'relative'
                }}
            >
                {!mapImage ? (
                    isCloudForcedGuide && cloudInitStatus === 'error' ? (
                        <div
                            style={{
                                margin: 16,
                                padding: 16,
                                borderRadius: 12,
                                border: '1px solid rgba(228, 50, 22, 0.3)',
                                background: 'rgba(228, 50, 22, 0.08)',
                                color: '#7f1d10',
                                fontWeight: 800,
                                lineHeight: 1.4
                            }}
                        >
                            {t('common.error')}: {cloudInitError || 'Failed to load required cloud map bundle.'}
                        </div>
                    ) : (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                            {t('map.noImage')}
                        </div>
                    )
                ) : (
                    <>
                        <MapViewer
                            ref={mapRef}
                            imageUrl={mapImage}
                            mapTileUrlTemplate={mapTileUrlTemplate}
                            mapTileMaxZoom={mapTileMaxZoom}
                            mapPixelWidth={mapPixelWidth}
                            mapPixelHeight={mapPixelHeight}
                            pins={pins}
                            currentLocationPoint={displayedHerePoint}
                            highlightedPinId={focusedPin?.id ?? nearest?.pin.id}
                            pinDisplayNameById={pinDisplayNameById}
                            fitToViewportOnInit={false}
                            centerOnImageOnInit={true}
                            focusedPinCard={
                                focusedPin
                                    ? {
                                        pinId: focusedPin.id,
                                        poiId: focusedPoi?.number || focusedPin.id,
                                        title: focusedPoi?.title || focusedPin.id,
                                        imageUrl: focusedPoi?.hero,
                                        summary: focusedPoi ? truncateSummary(focusedPoi.content, 100) : undefined
                                    }
                                    : undefined
                            }
                            showPinGpsCount={false}
                            initialScale={3}
                            onPinClick={handlePinFocus}
                            onMapClick={handleMapClick}
                        />

                        {nearest && !focusedPin && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    top: 16,
                                    background: 'var(--neutral-50)',
                                    color: 'var(--neutral-800)',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    border: '1px solid var(--neutral-200)',
                                    fontWeight: 900,
                                    fontSize: 12,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <span style={{ color: 'var(--neutral-700)' }}>{t('map.nearestLabel')}: </span>
                                    <span style={{ color: 'var(--misc-opam)' }}>
                                        {pinDisplayNameById[nearest.pin.id] || nearest.pin.id}
                                    </span>
                                    <span style={{ color: 'var(--neutral-700)' }}> • {t('map.gpsPointLabel')} </span>
                                    <span style={{ color: 'var(--misc-opam)' }}>#{nearest.pointIndex + 1}</span>
                                </div>
                                <div style={{ color: 'var(--neutral-700)' }}>
                                    {Math.round(nearest.distanceMeters)}m
                                </div>
                            </div>
                        )}

                        {pinsError && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    bottom: 16,
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-700)',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontWeight: 700,
                                    fontSize: 12
                                }}
                            >
                                {t('common.error')}: {pinsError}
                            </div>
                        )}

                    </>
                )}

                <button
                    onClick={handleSwapToCapture}
                    aria-label={t('map.swapToCapture')}
                    title={t('map.swapToCapture')}
                    style={{
                        position: 'fixed',
                        left: 16,
                        bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
                        width: 54,
                        height: 54,
                        borderRadius: 999,
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: 'rgba(245, 245, 245, 0.96)',
                        color: 'var(--neutral-800)',
                        boxShadow: '0 10px 22px rgba(0, 0, 0, 0.18)',
                        zIndex: 1200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        fontWeight: 900,
                        cursor: 'pointer'
                    }}
                >
                    <span aria-hidden="true" style={{ lineHeight: 1 }}>⇄</span>
                </button>
            </div>
        </div>
    );
};

export default GuideMap;
