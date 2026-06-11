import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapViewer, { type MapViewerHandle } from '../components/MapViewer';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import { transformLatLngToNormalized, transformNormalizedPoint } from '../utils/geoTransform';
import {
    loadCalibrationFromLocalStorage,
    loadDrawPinsFromLocalStorage,
    loadTraversableRegionsFromLocalStorage
} from '../utils/mapDrawData';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { GeoCalibration, MapPin, POI, RuntimeMapPin, TraversableRegion } from '../types';
import { findNearestPin } from '../utils/mapPins';
import {
    clampPointToNormalizedTraversableRegions,
    clampPointToTraversableRegionsWithNormalized,
    hasNormalizedTraversableRegions,
    hasTraversableRegions,
    isPointInsideNormalizedTraversableRegions,
    isPointInsideTraversableRegions,
    normalizeTraversableRegionsForRuntime,
    projectGeoPointIntoNormalizedRegion
} from '../utils/traversableRegions';

const truncateSummary = (text: string, maxChars = 100): string => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
};

const getGeolocationErrorMessage = (error: GeolocationPositionError | null, fallback: string) => {
    if (!error) return fallback;

    switch (error.code) {
        case error.PERMISSION_DENIED:
            return 'Location permission was denied.';
        case error.POSITION_UNAVAILABLE:
            return 'Current location is unavailable on this device right now.';
        case error.TIMEOUT:
            return 'Timed out while trying to get current location.';
        default:
            return error.message?.trim() || fallback;
    }
};

const GuideMapView: React.FC = () => {
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
    const [runtimePins, setRuntimePins] = useState<RuntimeMapPin[]>([]);
    const [geoCalibration, setGeoCalibration] = useState<GeoCalibration | null>(null);
    const [traversableRegions, setTraversableRegions] = useState<TraversableRegion[]>([]);
    const [pinsError, setPinsError] = useState<string | null>(null);
    const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
    const [focusedPinId, setFocusedPinId] = useState<string | null>(null);
    const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false);
    const [locationStatus, setLocationStatus] = useState<string | null>(null);
    const [shouldCenterOnCurrentLocation, setShouldCenterOnCurrentLocation] = useState(false);
    const mapRef = React.useRef<MapViewerHandle | null>(null);

    useEffect(() => {
        if (!guideId) {
            setGeoCalibration(data?.geoCalibration ?? null);
            setTraversableRegions([]);
            return;
        }
        setGeoCalibration(loadCalibrationFromLocalStorage(guideId) ?? data?.geoCalibration ?? null);
        setTraversableRegions(loadTraversableRegionsFromLocalStorage(guideId)?.regions ?? []);
    }, [data?.geoCalibration, guideId]);

    useEffect(() => {
        setPinsError(null);
        if (!guideId) {
            setPins([]);
            setRuntimePins([]);
            return;
        }

        const localDrawPins = loadDrawPinsFromLocalStorage(guideId)?.pins ?? [];
        setPins(localDrawPins);
        setRuntimePins(localDrawPins.map((pin) => ({
            id: pin.id,
            x: pin.x,
            y: pin.y,
            geoPosition: geoCalibration
                ? transformNormalizedPoint(geoCalibration.transform, { x: pin.x, y: pin.y })
                : undefined
        })));
    }, [geoCalibration, guideId]);

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

    const runtimeTraversableRegions = useMemo(() => {
        if (!data?.mapPixelWidth || !data?.mapPixelHeight) {
            return { normalizedRegions: [], geoRegions: [] };
        }
        return normalizeTraversableRegionsForRuntime(
            traversableRegions,
            geoCalibration,
            data.mapPixelWidth,
            data.mapPixelHeight,
            data.mapTileMaxZoom ?? 5
        );
    }, [data?.mapPixelHeight, data?.mapPixelWidth, data?.mapTileMaxZoom, geoCalibration, traversableRegions]);

    const traversableRegionsNormalized = runtimeTraversableRegions.normalizedRegions;
    const traversableRegionsGeo = runtimeTraversableRegions.geoRegions;

    const projectedHerePoint = useMemo(() => {
        if (!here || !geoCalibration) return null;
        const normalized = transformLatLngToNormalized(geoCalibration.transform, here);
        if (!normalized || !Number.isFinite(normalized.x) || !Number.isFinite(normalized.y)) return null;
        return normalized;
    }, [geoCalibration, here]);

    const displayedHerePoint = useMemo(() => {
        if (!here || !geoCalibration) return null;

        if (hasTraversableRegions(traversableRegionsGeo)) {
            for (const geoRegion of traversableRegionsGeo) {
                if (!isPointInsideTraversableRegions(here, [geoRegion])) continue;
                const normalizedRegion = traversableRegionsNormalized.find((region) => region.id === geoRegion.id);
                if (!normalizedRegion) continue;
                const mapped = projectGeoPointIntoNormalizedRegion(here, geoRegion, normalizedRegion);
                if (mapped && Number.isFinite(mapped.x) && Number.isFinite(mapped.y)) {
                    return {
                        x: Math.max(0, Math.min(1, mapped.x)),
                        y: Math.max(0, Math.min(1, mapped.y))
                    };
                }
            }
        }

        if (projectedHerePoint) {
            if (!hasNormalizedTraversableRegions(traversableRegionsNormalized)) {
                return {
                    x: Math.max(0, Math.min(1, projectedHerePoint.x)),
                    y: Math.max(0, Math.min(1, projectedHerePoint.y))
                };
            }

            if (isPointInsideNormalizedTraversableRegions(projectedHerePoint, traversableRegionsNormalized)) {
                return {
                    x: Math.max(0, Math.min(1, projectedHerePoint.x)),
                    y: Math.max(0, Math.min(1, projectedHerePoint.y))
                };
            }

            const clamped = clampPointToNormalizedTraversableRegions(projectedHerePoint, traversableRegionsNormalized);
            if (clamped) {
                return {
                    x: Math.max(0, Math.min(1, clamped.x)),
                    y: Math.max(0, Math.min(1, clamped.y))
                };
            }
        }

        if (hasTraversableRegions(traversableRegionsGeo) && !isPointInsideTraversableRegions(here, traversableRegionsGeo)) {
            const clamped = clampPointToTraversableRegionsWithNormalized(here, traversableRegionsGeo, traversableRegionsNormalized);
            if (clamped) {
                return {
                    x: Math.max(0, Math.min(1, clamped.normalizedPoint.x)),
                    y: Math.max(0, Math.min(1, clamped.normalizedPoint.y))
                };
            }
        }

        return null;
    }, [geoCalibration, here, projectedHerePoint, traversableRegionsGeo, traversableRegionsNormalized]);

    const displayedHere = useMemo(() => {
        if (!geoCalibration || !displayedHerePoint) return here;
        return transformNormalizedPoint(geoCalibration.transform, displayedHerePoint);
    }, [displayedHerePoint, geoCalibration, here]);

    const nearest = useMemo(() => {
        if (!displayedHere || runtimePins.length === 0) return null;
        return findNearestPin(runtimePins, displayedHere);
    }, [displayedHere, runtimePins]);

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

    useEffect(() => {
        if (!locationTrackingEnabled) {
            setLocationStatus(null);
            return;
        }

        if (!here) {
            setLocationStatus('Waiting for GPS...');
            return;
        }

        if (!displayedHerePoint) {
            setLocationStatus('Location found, but this view cannot place the dot yet.');
            return;
        }

        if (
            displayedHere
            && (
                Math.abs(displayedHere.lat - here.lat) > 1e-9
                || Math.abs(displayedHere.lng - here.lng) > 1e-9
            )
        ) {
            setLocationStatus('Showing the nearest allowed point inside the traversable area.');
            return;
        }

        setLocationStatus(null);
    }, [displayedHere, displayedHerePoint, here, locationTrackingEnabled]);

    useEffect(() => {
        if (!shouldCenterOnCurrentLocation || !displayedHerePoint) return;
        mapRef.current?.centerOnPoint(displayedHerePoint, { scale: 3 });
        setShouldCenterOnCurrentLocation(false);
    }, [displayedHerePoint, shouldCenterOnCurrentLocation]);

    const handlePinFocus = React.useCallback(
        (pinId: string) => {
            setFocusedPinId(pinId);
            const target = pins.find((pin) => pin.id === pinId);
            if (target) {
                mapRef.current?.centerOnPoint(
                    { x: target.x, y: target.y },
                    { yOffsetPx: 28 }
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

        setLocationStatus('Requesting GPS permission...');
        setShouldCenterOnCurrentLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationTrackingEnabled(true);
            },
            (error) => {
                const message = getGeolocationErrorMessage(error, t('map.locationDenied'));
                setLocationStatus(message);
                setShouldCenterOnCurrentLocation(false);
                window.alert(message);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
        );
    }, [t]);

    if (transLoading || guideLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;
    if (!data) return <div>{t('common.noData')}</div>;

    const mapTileUrlTemplate = data.mapTileUrlTemplate;
    const mapTileMaxZoom = data.mapTileMaxZoom;
    const mapPixelWidth = data.mapPixelWidth;
    const mapPixelHeight = data.mapPixelHeight;
    const mapImage = data.mapImage;

    const handleBackToGuideLanding = () => {
        const to = guideId ? `/${guideId}?${searchParams.toString()}` : `/?${searchParams.toString()}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => navigate(to));
        } else {
            navigate(to);
        }
    };

    const handleOpenDraw = () => {
        const to = guideId ? `/${guideId}/map/draw?${searchParams.toString()}` : `/?${searchParams.toString()}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => navigate(to));
        } else {
            navigate(to);
        }
    };

    return (
        <div className="page">
            <GlobalHeader
                title="Map View"
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
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button
                            onClick={handleOpenDraw}
                            aria-label="Draw"
                            title="Draw"
                            style={{
                                height: 42,
                                minWidth: 78,
                                borderRadius: 999,
                                border: 'none',
                                background: 'rgba(37, 99, 235, 0.14)',
                                color: '#2563eb',
                                fontWeight: 900,
                                fontSize: 14,
                                padding: '0 16px',
                                cursor: 'pointer'
                            }}
                        >
                            Draw
                        </button>
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
                    </div>
                }
            />

            <div className="scroll-content" style={{ position: 'relative' }}>
                {!mapTileUrlTemplate || !mapPixelWidth || !mapPixelHeight ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                        {t('map.noImage')}
                    </div>
                ) : (
                    <>
                        <MapViewer
                            ref={mapRef}
                            imageUrl={mapImage || ''}
                            mapTileUrlTemplate={mapTileUrlTemplate}
                            mapTileMaxZoom={mapTileMaxZoom}
                            mapPixelWidth={mapPixelWidth}
                            mapPixelHeight={mapPixelHeight}
                            pins={pins}
                            currentLocationPoint={displayedHerePoint}
                            traversableRegionsNormalized={traversableRegionsNormalized}
                            highlightedPinId={focusedPin?.id}
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

                        {nearest && !focusedPin && !displayedHerePoint && (
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
                                    bottom: locationStatus ? 84 : 16,
                                    background: 'rgba(127, 29, 16, 0.92)',
                                    color: 'rgba(245, 245, 245, 0.98)',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontWeight: 800,
                                    fontSize: 12
                                }}
                            >
                                {t('common.error')}: {pinsError}
                            </div>
                        )}

                        {locationStatus && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    bottom: 16,
                                    background: 'rgba(33, 36, 39, 0.88)',
                                    color: 'rgba(245, 245, 245, 0.98)',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontWeight: 800,
                                    fontSize: 12
                                }}
                            >
                                {locationStatus}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default GuideMapView;
