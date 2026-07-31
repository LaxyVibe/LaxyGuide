import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapAssetLoadingBar from '../components/MapAssetLoadingBar';
import MapViewer, { type MapViewerHandle } from '../components/MapViewer';
import { useGuideData } from '../hooks/useGuideData';
import { useMapTileBundle } from '../hooks/useMapTileBundle';
import { useTranslation } from '../hooks/useTranslation';
import { transformLatLngToNormalized, transformNormalizedPoint } from '../utils/geoTransform';
import {
    buildRuntimePinsFromAuthoringDocument,
    createBootstrapMapAuthoringDocument,
    fetchMapAuthoringJson,
    isMapAuthoringEnabledGuide
} from '../utils/mapDrawData';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { GeoCalibration, MapPin, MapPinsFile, POI, RuntimeMapPin, TraversableRegion } from '../types';
import { fetchPinsFile, findNearestPin } from '../utils/mapPins';
import {
    clampPointToNormalizedTraversableRegions,
    clampPointToTraversableRegionsWithNormalized,
    hasNormalizedTraversableRegions,
    hasTraversableRegions,
    isPointInsideNormalizedTraversableRegions,
    isPointInsideTraversableRegions,
    projectGeoPointIntoNormalizedRegion
} from '../utils/traversableRegions';
import {
    buildGuideMapRuntimeTraversableRegionSet,
    resolveGuideMapRuntimeGeometry
} from '../utils/guideMapRuntime';

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

const GEOLOCATION_DENIED_HELP = [
    'Chrome denied location access for this page.',
    'Check Chrome site settings for localhost and set Location to Allow.',
    'Also check macOS System Settings > Privacy & Security > Location Services and make sure Google Chrome is enabled.'
].join(' ');

async function readGeolocationPermissionState(): Promise<PermissionState | 'unsupported' | null> {
    if (!('permissions' in navigator) || typeof navigator.permissions?.query !== 'function') {
        return 'unsupported';
    }

    try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state;
    } catch {
        return 'unsupported';
    }
}

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
    const [showDebugInfo, setShowDebugInfo] = useState(false);
    const [geolocationPermissionState, setGeolocationPermissionState] = useState<PermissionState | 'unsupported' | null>(null);
    const [authoringLoading, setAuthoringLoading] = useState(true);
    const mapRef = React.useRef<MapViewerHandle | null>(null);
    const canUseRemoteAuthoring = isMapAuthoringEnabledGuide(guideId);
    const hasHostedMapBundle = Boolean(data?.mapTileBundleUrl);
    const {
        bundle: resolvedMapTileBundle,
        loading: mapTileBundleLoading,
        error: mapTileBundleError
    } = useMapTileBundle({
        bundleUrl: data?.mapTileBundleUrl,
        guideId,
        mapPixelWidth: data?.mapPixelWidth,
        mapPixelHeight: data?.mapPixelHeight,
        mapTileMaxZoom: data?.mapTileMaxZoom
    });
    const mapTileBundle = resolvedMapTileBundle;

    const runtimeMapGeometry = useMemo(() => (
        data
            ? resolveGuideMapRuntimeGeometry({
                guideData: data,
                mapTileBundle
            })
            : {}
    ), [data, mapTileBundle]);

    useEffect(() => {
        let cancelled = false;

        const loadBootstrapDocument = async (nextGuideId: string) => {
            let pinsFile: MapPinsFile | null = null;

            if (data?.mapPinsUrl) {
                try {
                    pinsFile = await fetchPinsFile(data.mapPinsUrl);
                } catch (error) {
                    if (!cancelled) {
                        setPinsError(error instanceof Error ? error.message : String(error));
                    }
                }
            }

            return createBootstrapMapAuthoringDocument({
                guideId: nextGuideId,
                calibration: data?.geoCalibration ?? null,
                pins: pinsFile ?? { version: 2, guideId: nextGuideId, pins: [] },
                traversableRegions: {
                    version: 1,
                    guideId: nextGuideId,
                    regions: []
                }
            });
        };

        const run = async () => {
            setPinsError(null);
            setAuthoringLoading(true);

            if (!guideId) {
                setPins([]);
                setRuntimePins([]);
                setGeoCalibration(data?.geoCalibration ?? null);
                setTraversableRegions([]);
                setAuthoringLoading(false);
                return;
            }

            try {
                const remoteDocument = canUseRemoteAuthoring
                    ? await fetchMapAuthoringJson(guideId)
                    : null;
                if (cancelled) return;

                const document = remoteDocument ?? await loadBootstrapDocument(guideId);
                if (cancelled) return;

                setGeoCalibration(document.calibration);
                setTraversableRegions(document.traversableRegions);
                setPins(document.pins);
                setRuntimePins(buildRuntimePinsFromAuthoringDocument(document));
            } catch (error) {
                if (cancelled) return;
                setPinsError(error instanceof Error ? error.message : String(error));
                const bootstrapDocument = await loadBootstrapDocument(guideId);
                if (cancelled) return;
                setGeoCalibration(bootstrapDocument.calibration);
                setTraversableRegions(bootstrapDocument.traversableRegions);
                setPins(bootstrapDocument.pins);
                setRuntimePins(buildRuntimePinsFromAuthoringDocument(bootstrapDocument));
            } finally {
                if (!cancelled) {
                    setAuthoringLoading(false);
                }
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [canUseRemoteAuthoring, data?.geoCalibration, data?.mapPinsUrl, guideId]);

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

    useEffect(() => {
        let cancelled = false;

        readGeolocationPermissionState().then((state) => {
            if (!cancelled) {
                setGeolocationPermissionState(state);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const runtimeTraversableRegions = useMemo(() => {
        if (!data) {
            return { normalizedRegions: [], geoRegions: [] };
        }
        return buildGuideMapRuntimeTraversableRegionSet({
            guideData: data,
            mapTileBundle,
            geoCalibration,
            traversableRegions
        });
    }, [data, geoCalibration, mapTileBundle, traversableRegions]);

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

        if (!window.isSecureContext) {
            const message = 'Location requires a secure context. Use localhost, 127.0.0.1, or HTTPS.';
            setLocationStatus(message);
            setShouldCenterOnCurrentLocation(false);
            window.alert(message);
            return;
        }

        setLocationStatus('Requesting GPS permission...');
        setShouldCenterOnCurrentLocation(true);
        readGeolocationPermissionState().then((state) => {
            setGeolocationPermissionState(state);

            if (state === 'denied') {
                setLocationStatus(GEOLOCATION_DENIED_HELP);
                setShouldCenterOnCurrentLocation(false);
                window.alert(GEOLOCATION_DENIED_HELP);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setLocationTrackingEnabled(true);
                    readGeolocationPermissionState().then((nextState) => setGeolocationPermissionState(nextState));
                },
                (error) => {
                    const baseMessage = getGeolocationErrorMessage(error, t('map.locationDenied'));
                    const message = error?.code === error.PERMISSION_DENIED
                        ? `${baseMessage} ${GEOLOCATION_DENIED_HELP}`
                        : baseMessage;
                    setLocationStatus(message);
                    setShouldCenterOnCurrentLocation(false);
                    readGeolocationPermissionState().then((nextState) => setGeolocationPermissionState(nextState));
                    window.alert(message);
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
            );
        });
    }, [t]);

    const shouldWaitForTileBundle = hasHostedMapBundle && mapTileBundleLoading;

    if (transLoading || guideLoading || authoringLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;
    if (!data) return <div>{t('common.noData')}</div>;

    const {
        mapTileUrlTemplate,
        mapTileMaxZoom,
        mapPixelWidth,
        mapPixelHeight,
        mapImage
    } = runtimeMapGeometry;

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
                            onClick={() => setShowDebugInfo((prev) => !prev)}
                            aria-label="Debug"
                            title="Debug"
                            style={{
                                height: 42,
                                minWidth: 78,
                                borderRadius: 999,
                                border: 'none',
                                background: showDebugInfo ? 'rgba(22, 163, 74, 0.16)' : 'rgba(33, 36, 39, 0.1)',
                                color: showDebugInfo ? '#15803d' : 'var(--neutral-800)',
                                fontWeight: 900,
                                fontSize: 14,
                                padding: '0 16px',
                                cursor: 'pointer'
                            }}
                        >
                            Debug
                        </button>
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
                {shouldWaitForTileBundle ? (
                    <MapAssetLoadingBar />
                ) : !mapTileUrlTemplate || !mapPixelWidth || !mapPixelHeight ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                        {t('map.noImage')}
                    </div>
                ) : (
                    <>
                        <MapViewer
                            ref={mapRef}
                            imageUrl={mapImage || ''}
                            mapTileUrlTemplate={mapTileUrlTemplate}
                            mapTileBundle={mapTileBundle ?? undefined}
                            mapLanguage={lang}
                            mapTileMaxZoom={mapTileMaxZoom}
                            mapPixelWidth={mapPixelWidth}
                            mapPixelHeight={mapPixelHeight}
                            pins={pins}
                            currentLocationPoint={displayedHerePoint}
                            traversableRegions={traversableRegions}
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

                        {showDebugInfo && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    top: 16,
                                    maxHeight: '46dvh',
                                    overflow: 'auto',
                                    background: 'rgba(255, 255, 255, 0.97)',
                                    color: 'var(--neutral-800)',
                                    padding: '12px 14px',
                                    borderRadius: 14,
                                    border: '1px solid rgba(33, 36, 39, 0.12)',
                                    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.16)',
                                    zIndex: 1200,
                                    fontSize: 12,
                                    lineHeight: 1.45
                                }}
                            >
                                <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 8 }}>
                                    Debug Info
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <strong>Secure context:</strong>{' '}
                                    {window.isSecureContext ? 'yes' : 'no'}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <strong>Geolocation permission:</strong>{' '}
                                    {geolocationPermissionState ?? 'checking'}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <strong>現在地 raw GPS:</strong>{' '}
                                    {here
                                        ? `${here.lat.toFixed(6)}, ${here.lng.toFixed(6)}`
                                        : 'not available'}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <strong>現在地 displayed GPS:</strong>{' '}
                                    {displayedHere
                                        ? `${displayedHere.lat.toFixed(6)}, ${displayedHere.lng.toFixed(6)}`
                                        : 'not available'}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <strong>現在地 displayed normalized:</strong>{' '}
                                    {displayedHerePoint
                                        ? `${displayedHerePoint.x.toFixed(4)}, ${displayedHerePoint.y.toFixed(4)}`
                                        : 'not available'}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <strong>Traversable regions:</strong> {traversableRegionsGeo.length}
                                </div>
                                {traversableRegionsGeo.length === 0 ? (
                                    <div style={{ color: 'var(--neutral-600)' }}>
                                        No traversable geo polygons loaded.
                                    </div>
                                ) : (
                                    traversableRegionsGeo.map((region) => (
                                        <div
                                            key={region.id}
                                            style={{
                                                marginTop: 10,
                                                paddingTop: 10,
                                                borderTop: '1px solid rgba(33, 36, 39, 0.1)'
                                            }}
                                        >
                                            <div style={{ fontWeight: 900, marginBottom: 6 }}>
                                                Region {region.id}
                                            </div>
                                            <div
                                                style={{
                                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}
                                            >
                                                {(region.polygon ?? [])
                                                    .map((point, index) => `${index + 1}. ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`)
                                                    .join('\n')}
                                            </div>
                                        </div>
                                    ))
                                )}
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

                        {mapTileBundleError && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    bottom: pinsError
                                        ? (locationStatus ? 152 : 84)
                                        : (locationStatus ? 84 : 16),
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-700)',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontWeight: 700,
                                    fontSize: 12
                                }}
                            >
                                {t('common.error')}: {mapTileBundleError}
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
