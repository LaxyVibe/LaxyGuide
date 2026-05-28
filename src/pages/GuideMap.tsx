import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapViewer, { type MapViewerHandle } from '../components/MapViewer';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { MapPin, MapPinsFile, POI } from '../types';
import { fetchPinsFile, findNearestPin, loadPinsFromLocalStorage } from '../utils/mapPins';

const truncateSummary = (text: string, maxChars = 100): string => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
};

const computeFocusScale = (): number => {
    if (typeof window === 'undefined') return 2.2;
    const viewportWidth = window.innerWidth;
    const minSide = Math.min(window.innerWidth, window.innerHeight);

    const CARD_WIDTH_PX = 180;
    const CARD_SIDE_MARGIN_PX = 16;
    const CARD_SAFE_BLEED_PX = 12;
    const horizontalBudget = Math.max(120, viewportWidth - (CARD_SIDE_MARGIN_PX * 2));
    const maxScaleForCardFit = Math.max(1, (horizontalBudget - CARD_SAFE_BLEED_PX) / CARD_WIDTH_PX);

    // Base focus from viewport geometry, then cap by card-fit scale to avoid horizontal clipping.
    const baseScale = Math.max(1.8, Math.min(3.2, minSide / 210));
    const fittedScale = Math.max(1.2, Math.min(baseScale, maxScaleForCardFit));

    // Step down one more level to keep focused cards visible on tight viewports.
    return Math.max(1.1, fittedScale - 1.8);
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
    const [pinsError, setPinsError] = useState<string | null>(null);
    const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
    const [mapImageOverride, setMapImageOverride] = useState<string | null>(null);
    const [focusedPinId, setFocusedPinId] = useState<string | null>(null);
    const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
    const mapRef = React.useRef<MapViewerHandle | null>(null);

    useEffect(() => {
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
    }, [guideId]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setPinsError(null);
            if (!guideId) return;

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
    }, [guideId, data?.mapPinsUrl]);

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

    const nearest = useMemo(() => {
        if (!here || pins.length === 0) return null;
        return findNearestPin(pins, here);
    }, [here, pins]);

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
        const poiNumber = (focusedPin.label ?? '').trim();
        if (!poiNumber) return null;
        return poiByNumber.get(poiNumber) ?? null;
    }, [focusedPin, poiByNumber]);

    const pinDisplayNameById = useMemo(() => {
        const out: Record<string, string> = {};
        for (const pin of pins) {
            const poiNumber = (pin.label ?? pin.id).trim();
            const poiTitle = poiByNumber.get(poiNumber)?.title;
            out[pin.id] = poiTitle || pin.label || pin.id;
        }
        return out;
    }, [pins, poiByNumber]);

    const handlePinFocus = React.useCallback(
        (pinId: string) => {
            setFocusedPinId(pinId);
            const target = pins.find((pin) => pin.id === pinId);
            if (target) {
                mapRef.current?.centerOnPoint(
                    { x: target.x, y: target.y },
                    {
                        scale: computeFocusScale(),
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

    const mapImage = mapImageOverride || data?.mapImage;

    if (transLoading || guideLoading) return <Loading />;
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
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                        {t('map.noImage')}
                    </div>
                ) : (
                    <>
                        <MapViewer
                            ref={mapRef}
                            imageUrl={mapImage}
                            pins={pins}
                            highlightedPinId={focusedPin?.id ?? nearest?.pin.id}
                            pinDisplayNameById={pinDisplayNameById}
                            fitToViewportOnInit={false}
                            centerOnImageOnInit={true}
                            focusedPinCard={
                                focusedPin
                                    ? {
                                        pinId: focusedPin.id,
                                        poiId: focusedPoi?.number || (focusedPin.label ?? focusedPin.id),
                                        title: focusedPoi?.title || focusedPin.label || focusedPin.id,
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
                                        {pinDisplayNameById[nearest.pin.id] || nearest.pin.label || nearest.pin.id}
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
