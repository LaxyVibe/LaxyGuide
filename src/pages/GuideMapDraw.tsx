import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MapPin as MapPinIcon, Plus, Trash2 } from 'lucide-react';
import GeoCalibrationOverlayEditor from '../components/GeoCalibrationOverlayEditor';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import TiledMapDrawer from '../components/TiledMapDrawer';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import type { GeoCalibration, MapPin, MapPinsFile, TraversableRegion, TraversableRegionsFile } from '../types';
import {
    loadCalibrationFromLocalStorage,
    loadTraversableRegionsFromLocalStorage,
    saveCalibrationToLocalStorage,
    saveTraversableRegionsToLocalStorage
} from '../utils/mapDrawData';
import { downloadJson, fetchPinsFile, normalizePinsFile } from '../utils/mapPins';
import { getNextNumericId } from '../utils/pinIdUtils';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import { buildCornerBilinearCalibration, transformNormalizedPoint, type GeoPoint } from '../utils/geoTransform';

type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';
type DrawLayerMode = 'pins' | 'traversable';
type DeleteTarget =
    | { kind: 'pin-region'; pinId: string }
    | { kind: 'traversable-region'; regionId: string }
    | null;
const CORNER_ORDER: CornerKey[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
const CORNER_LABEL: Record<CornerKey, string> = {
    topLeft: 'Top Left',
    topRight: 'Top Right',
    bottomRight: 'Bottom Right',
    bottomLeft: 'Bottom Left'
};
const CORNER_IMAGE_COORDINATES: Record<CornerKey, { x: number; y: number }> = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 },
    bottomLeft: { x: 0, y: 1 }
};

const getDrawStorageKey = (guideId: string) => `mapPins_draw_${guideId}`;
const TILE_SIZE = 256;

function loadDrawPinsFromLocalStorage(guideId: string): MapPinsFile | null {
    try {
        const raw = localStorage.getItem(getDrawStorageKey(guideId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as MapPinsFile;
        if (!parsed || !Array.isArray(parsed.pins)) return null;
        return normalizePinsFile(parsed, guideId);
    } catch {
        return null;
    }
}

function saveDrawPinsToLocalStorage(guideId: string, pinsFile: MapPinsFile) {
    localStorage.setItem(getDrawStorageKey(guideId), JSON.stringify(normalizePinsFile(pinsFile, guideId)));
}

function getCalibrationDraftCorners(calibration: GeoCalibration | null): Partial<Record<CornerKey, GeoPoint>> {
    if (!calibration) return {};

    return {
        topLeft: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.topLeft),
        topRight: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.topRight),
        bottomRight: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.bottomRight),
        bottomLeft: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.bottomLeft)
    };
}

function getCalibrationCornerGeoPoints(calibration: GeoCalibration | null) {
    if (!calibration) return null;

    return {
        topLeft: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.topLeft),
        topRight: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.topRight),
        bottomRight: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.bottomRight),
        bottomLeft: transformNormalizedPoint(calibration.transform, CORNER_IMAGE_COORDINATES.bottomLeft)
    };
}

function mergePinsWithDrawOverrides(basePins: MapPin[], drawPins: MapPin[]): MapPin[] {
    const drawById = new Map(drawPins.map((pin) => [pin.id, pin]));
    const baseIds = new Set(basePins.map((pin) => pin.id));

    // Update polygons on existing base pins, then append draw-only pins
    // (created via the + button) so they survive page reloads.
    const merged = basePins.map((pin) => {
        const drawPin = drawById.get(pin.id);
        if (!drawPin) return pin;
        return {
            ...pin,
            x: Number.isFinite(drawPin.x) ? drawPin.x : pin.x,
            y: Number.isFinite(drawPin.y) ? drawPin.y : pin.y,
            polygon: drawPin.polygon
        };
    });

    const drawOnlyPins = drawPins.filter((pin) => !baseIds.has(pin.id));
    return [...merged, ...drawOnlyPins];
}

function buildTileUrl(template: string, z: number, x: number, y: number) {
    return template
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y));
}

function loadImageElement(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load tile image: ${src}`));
        image.src = src;
    });
}

async function buildCalibrationImageFromTiles(
    mapTileUrlTemplate: string,
    mapTileMaxZoom: number,
    mapPixelWidth: number,
    mapPixelHeight: number
) {
    const canvas = document.createElement('canvas');
    canvas.width = mapPixelWidth;
    canvas.height = mapPixelHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');

    const columns = Math.ceil(mapPixelWidth / TILE_SIZE);
    const rows = Math.ceil(mapPixelHeight / TILE_SIZE);
    const tasks: Promise<void>[] = [];

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
            const tileUrl = buildTileUrl(mapTileUrlTemplate, mapTileMaxZoom, x, y);
            tasks.push(
                loadImageElement(tileUrl).then((image) => {
                    context.drawImage(image, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                })
            );
        }
    }

    await Promise.all(tasks);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
            if (value) {
                resolve(value);
                return;
            }
            reject(new Error('Failed to encode stitched calibration image'));
        }, 'image/png');
    });

    return URL.createObjectURL(blob);
}

function createEmptyTraversableRegionsFile(guideId: string): TraversableRegionsFile {
    return {
        version: 1,
        guideId,
        regions: []
    };
}

function getTraversableRegionTitle(regionId: string) {
    return `Region ${regionId}`;
}

const GuideMapDraw: React.FC = () => {
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

    const [drawLayerMode, setDrawLayerMode] = useState<DrawLayerMode>('pins');
    const [pinsFile, setPinsFile] = useState<MapPinsFile | null>(null);
    const [traversableRegionsFile, setTraversableRegionsFile] = useState<TraversableRegionsFile | null>(null);
    const [pinsError, setPinsError] = useState<string | null>(null);
    const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
    const [selectedTraversableRegionId, setSelectedTraversableRegionId] = useState<string | null>(null);
    const [movePinMode, setMovePinMode] = useState(false);
    const initialSelectRef = useRef(true);
    const initialTraversableSelectRef = useRef(true);
    const [fabMenuOpen, setFabMenuOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
    const [showCalibrateWizard, setShowCalibrateWizard] = useState(false);
    const [calibrationDraftCorners, setCalibrationDraftCorners] = useState<Partial<Record<CornerKey, GeoPoint>>>({});
    const [calibrationActiveCorner, setCalibrationActiveCorner] = useState<CornerKey | null>(null);
    const [calibrationSeedVersion, setCalibrationSeedVersion] = useState(0);
    const [calibrationOverlayOpacity, setCalibrationOverlayOpacity] = useState(0.62);
    const [calibrationTileImageUrl, setCalibrationTileImageUrl] = useState<string | null>(null);
    const [geoCalibration, setGeoCalibration] = useState<GeoCalibration | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setPinsError(null);
            if (!guideId) {
                setPinsFile(null);
                setTraversableRegionsFile(null);
                return;
            }

            const localTraversableFile = loadTraversableRegionsFromLocalStorage(guideId)
                ?? createEmptyTraversableRegionsFile(guideId);

            const url = data?.mapPinsUrl;
            if (!url) {
                // No server file — restore any pins saved locally (e.g. via the + button).
                const localFile = loadDrawPinsFromLocalStorage(guideId);
                const localPins = localFile?.pins ?? [];
                setPinsFile({ version: 2, guideId, pins: localPins });
                setTraversableRegionsFile(localTraversableFile);
                setSelectedPinId((prev) => {
                    if (prev && localPins.some((pin) => pin.id === prev)) return prev;
                    return localPins[0]?.id ?? null;
                });
                setSelectedTraversableRegionId((prev) => {
                    if (prev && localTraversableFile.regions.some((region) => region.id === prev)) return prev;
                    return localTraversableFile.regions[0]?.id ?? null;
                });
                return;
            }

            try {
                const baseFile = await fetchPinsFile(url);
                if (cancelled) return;

                const drawLocalFile = loadDrawPinsFromLocalStorage(guideId);
                const mergedPins = drawLocalFile
                    ? mergePinsWithDrawOverrides(baseFile.pins ?? [], drawLocalFile.pins ?? [])
                    : (baseFile.pins ?? []);

                const mergedFile: MapPinsFile = {
                    version: 2,
                    guideId,
                    pins: mergedPins
                };

                setPinsFile(mergedFile);
                setTraversableRegionsFile(localTraversableFile);
                setGeoCalibration(loadCalibrationFromLocalStorage(guideId) ?? data?.geoCalibration ?? null);
                setSelectedPinId((prev) => {
                    if (prev && mergedPins.some((pin) => pin.id === prev)) return prev;
                    return mergedPins[0]?.id ?? null;
                });
                setSelectedTraversableRegionId((prev) => {
                    if (prev && localTraversableFile.regions.some((region) => region.id === prev)) return prev;
                    return localTraversableFile.regions[0]?.id ?? null;
                });
            } catch (e) {
                if (cancelled) return;
                setPinsFile({ version: 2, guideId, pins: [] });
                setTraversableRegionsFile(localTraversableFile);
                setGeoCalibration(loadCalibrationFromLocalStorage(guideId) ?? data?.geoCalibration ?? null);
                setPinsError(e instanceof Error ? e.message : String(e));
                setSelectedTraversableRegionId((prev) => {
                    if (prev && localTraversableFile.regions.some((region) => region.id === prev)) return prev;
                    return localTraversableFile.regions[0]?.id ?? null;
                });
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [guideId, data?.mapPinsUrl]);

    useEffect(() => {
        if (!guideId) return;
        saveCalibrationToLocalStorage(guideId, geoCalibration);
    }, [guideId, geoCalibration]);

    useEffect(() => {
        let cancelled = false;

        const clearCurrentImage = () => {
            setCalibrationTileImageUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        };

        const run = async () => {
            const template = data?.mapTileUrlTemplate;
            const maxZoom = data?.mapTileMaxZoom;
            const pixelWidth = data?.mapPixelWidth;
            const pixelHeight = data?.mapPixelHeight;

            if (!template || !Number.isFinite(pixelWidth) || !Number.isFinite(pixelHeight)) {
                clearCurrentImage();
                return;
            }

            clearCurrentImage();

            try {
                const nextUrl = await buildCalibrationImageFromTiles(
                    template,
                    maxZoom ?? 5,
                    pixelWidth!,
                    pixelHeight!
                );

                if (cancelled) {
                    URL.revokeObjectURL(nextUrl);
                    return;
                }

                setCalibrationTileImageUrl(nextUrl);
            } catch {
                if (!cancelled) {
                    clearCurrentImage();
                }
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [data?.mapTileUrlTemplate, data?.mapTileMaxZoom, data?.mapPixelWidth, data?.mapPixelHeight]);

    useEffect(() => {
        return () => {
            if (calibrationTileImageUrl) {
                URL.revokeObjectURL(calibrationTileImageUrl);
            }
        };
    }, [calibrationTileImageUrl]);

    const pins = pinsFile?.pins ?? [];
    const traversableRegions = traversableRegionsFile?.regions ?? [];

    useEffect(() => {
        if (selectedPinId) {
            initialSelectRef.current = false;
            return;
        }
        if (pins.length === 0) return;
        if (initialSelectRef.current) {
            setSelectedPinId(pins[0].id);
            initialSelectRef.current = false;
        }
    }, [pins, selectedPinId]);

    useEffect(() => {
        if (selectedTraversableRegionId && traversableRegions.some((region) => region.id === selectedTraversableRegionId)) {
            initialTraversableSelectRef.current = false;
            return;
        }
        if (traversableRegions.length === 0) return;
        if (initialTraversableSelectRef.current) {
            setSelectedTraversableRegionId(traversableRegions[0].id);
            initialTraversableSelectRef.current = false;
        }
    }, [traversableRegions, selectedTraversableRegionId]);

    useEffect(() => {
        if (drawLayerMode === 'traversable') {
            setMovePinMode(false);
        }
    }, [drawLayerMode]);

    const pinDisplayNameById = useMemo(() => {
        const byNumber = new Map((data?.pois ?? []).map((poi) => [poi.number, poi.title]));
        const out: Record<string, string> = {};
        for (const pin of pins) {
            out[pin.id] = byNumber.get(pin.id) || pin.id;
        }
        return out;
    }, [pins, data?.pois]);

    const handlePolygonChange = React.useCallback(
        (pinId: string, polygon: Array<{ lat: number; lng: number }> | undefined) => {
            if (!guideId) return;
            setPinsFile((prev) => {
                if (!prev) return prev;
                const nextPins = prev.pins.map((pin) => {
                    if (pin.id !== pinId) return pin;
                    return {
                        ...pin,
                        polygon
                    };
                });
                const next: MapPinsFile = {
                    ...prev,
                    guideId,
                    version: 2,
                    pins: nextPins
                };
                saveDrawPinsToLocalStorage(guideId, next);
                return next;
            });
        },
        [guideId]
    );

    const handleTraversableRegionPolygonChange = React.useCallback(
        (regionId: string, polygon: Array<{ lat: number; lng: number }> | undefined) => {
            if (!guideId) return;
            setTraversableRegionsFile((prev) => {
                const base = prev ?? createEmptyTraversableRegionsFile(guideId);
                const nextRegions = base.regions.map((region) => (
                    region.id === regionId
                        ? { ...region, polygon: polygon ?? [] }
                        : region
                ));
                const next: TraversableRegionsFile = {
                    ...base,
                    guideId,
                    version: 1,
                    regions: nextRegions
                };
                saveTraversableRegionsToLocalStorage(guideId, next);
                return next;
            });
        },
        [guideId]
    );

    const handleMoveSelectedPin = React.useCallback((point: { x: number; y: number }) => {
        if (!guideId || !selectedPinId) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const nextPins = prev.pins.map((pin) => {
                if (pin.id !== selectedPinId) return pin;
                return {
                    ...pin,
                    x: point.x,
                    y: point.y
                };
            });

            const next: MapPinsFile = {
                ...prev,
                version: 2,
                guideId,
                pins: nextPins
            };
            saveDrawPinsToLocalStorage(guideId, next);
            return next;
        });

        setMovePinMode(false);
    }, [guideId, selectedPinId]);

    const createPinAt = React.useCallback((point: { x: number; y: number }) => {
        if (!guideId) return;

        const currentPins = pinsFile?.pins ?? [];
        const nextId = getNextNumericId(currentPins.map((pin) => pin.id));
        const nextPin: MapPin = {
            id: nextId,
            x: point.x,
            y: point.y,
            latLngs: [],
            createdAt: new Date().toISOString()
        };

        const next: MapPinsFile = {
            version: 2,
            guideId,
            pins: [...currentPins, nextPin]
        };

        setPinsFile(next);
        saveDrawPinsToLocalStorage(guideId, next);
        setSelectedPinId(nextId);
    }, [guideId, pinsFile]);

    const handleAddPin = React.useCallback(() => {
        createPinAt({ x: 0.5, y: 0.5 });
    }, [createPinAt]);

    const handleAddTraversableRegion = React.useCallback(() => {
        if (!guideId) return;

        const currentRegions = traversableRegionsFile?.regions ?? [];
        const nextId = getNextNumericId(currentRegions.map((region) => region.id));
        const nextRegion: TraversableRegion = {
            id: nextId,
            polygon: []
        };

        const next: TraversableRegionsFile = {
            version: 1,
            guideId,
            regions: [...currentRegions, nextRegion]
        };

        setTraversableRegionsFile(next);
        saveTraversableRegionsToLocalStorage(guideId, next);
        setSelectedTraversableRegionId(nextId);
    }, [guideId, traversableRegionsFile]);

    const handleDeleteTraversableRegion = React.useCallback((regionId: string) => {
        if (!guideId || !regionId) return;
        const base = traversableRegionsFile ?? createEmptyTraversableRegionsFile(guideId);
        const nextRegions = base.regions.filter((region) => region.id !== regionId);
        const next: TraversableRegionsFile = {
            ...base,
            guideId,
            version: 1,
            regions: nextRegions
        };
        setTraversableRegionsFile(next);
        saveTraversableRegionsToLocalStorage(guideId, next);
        setSelectedTraversableRegionId((prev) => (prev === regionId ? (nextRegions[0]?.id ?? null) : prev));
    }, [guideId, traversableRegionsFile]);

    const handleDeletePinRegion = React.useCallback((pinId: string) => {
        if (!guideId || !pinId) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const nextPins = prev.pins.map((pin) => (
                pin.id === pinId
                    ? { ...pin, polygon: undefined }
                    : pin
            ));
            const next: MapPinsFile = {
                ...prev,
                version: 2,
                guideId,
                pins: nextPins
            };
            saveDrawPinsToLocalStorage(guideId, next);
            return next;
        });
    }, [guideId]);

    const handleConfirmDelete = React.useCallback(() => {
        if (!deleteTarget) return;

        if (deleteTarget.kind === 'pin-region') {
            handleDeletePinRegion(deleteTarget.pinId);
        } else {
            handleDeleteTraversableRegion(deleteTarget.regionId);
        }

        setDeleteTarget(null);
    }, [deleteTarget, handleDeletePinRegion, handleDeleteTraversableRegion]);

    const handleBackToView = () => {
        const to = guideId ? `/${guideId}/map?${searchParams.toString()}` : `/?${searchParams.toString()}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => navigate(to));
        } else {
            navigate(to);
        }
    };

    const handleExport = () => {
        if (!guideId) return;
        const calibration = geoCalibration ?? data?.geoCalibration ?? null;
        const mapTileCorners = getCalibrationCornerGeoPoints(calibration);
        const payload = {
            version: 3,
            guideId,
            mapTileCorners,
            calibration,
            traversableRegions: traversableRegions
                .filter((region) => Array.isArray(region.polygon) && region.polygon.length >= 3)
                .map((region) => ({
                    id: region.id,
                    polygon: region.polygon
                })),
            pins: pins.map((pin) => ({
                id: pin.id,
                pinDisplayPosition: {
                    x: pin.x,
                    y: pin.y,
                    geoPosition: calibration
                        ? transformNormalizedPoint(calibration.transform, { x: pin.x, y: pin.y })
                        : undefined
                },
                region: {
                    polygon: pin.polygon ?? []
                }
            }))
        };
        downloadJson(`${guideId}-draw-map-regions.json`, payload);
    };

    const calibrationSeedPoints = useMemo(() => {
        const points: GeoPoint[] = [];
        for (const pin of pins) {
            for (const point of pin.latLngs ?? []) {
                if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
                    points.push({ lat: point.lat, lng: point.lng });
                }
            }
            for (const point of pin.polygon ?? []) {
                if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
                    points.push({ lat: point.lat, lng: point.lng });
                }
            }
        }
        for (const region of traversableRegions) {
            for (const point of region.polygon ?? []) {
                if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
                    points.push({ lat: point.lat, lng: point.lng });
                }
            }
        }
        return points;
    }, [pins, traversableRegions]);

    const completedCorners = CORNER_ORDER.filter((key) => Boolean(calibrationDraftCorners[key])).length;
    const canFinish = CORNER_ORDER.every((key) => Boolean(calibrationDraftCorners[key]));
    const calibrationRmsText = geoCalibration?.method === 'affine'
        ? (geoCalibration.rmsErrorMeters?.toFixed(2) ?? 'n/a')
        : 'n/a';

    const handleOpenCalibrationEditor = React.useCallback(() => {
        const calibration = geoCalibration ?? data?.geoCalibration ?? null;
        setCalibrationDraftCorners(getCalibrationDraftCorners(calibration));
        setCalibrationActiveCorner(null);
        setCalibrationSeedVersion((prev) => prev + 1);
        setShowCalibrateWizard(true);
        setFabMenuOpen(false);
    }, [geoCalibration, data?.geoCalibration]);

    const handleResetCalibrationEditor = React.useCallback(() => {
        setCalibrationDraftCorners({});
        setCalibrationActiveCorner(null);
        setCalibrationSeedVersion((prev) => prev + 1);
    }, []);

    const handleCalibrationMapPick = React.useCallback((point: GeoPoint) => {
        if (!calibrationActiveCorner) return;
        setCalibrationDraftCorners((prev) => ({
            ...prev,
            [calibrationActiveCorner]: point
        }));
        setCalibrationActiveCorner(null);
    }, [calibrationActiveCorner]);

    const handleBuildCalibration = () => {
        if (!guideId) return;
        if (!canFinish) return;

        const result = buildCornerBilinearCalibration({
            topLeft: {
                id: 'topLeft',
                label: CORNER_LABEL.topLeft,
                ...CORNER_IMAGE_COORDINATES.topLeft,
                ...calibrationDraftCorners.topLeft!
            },
            topRight: {
                id: 'topRight',
                label: CORNER_LABEL.topRight,
                ...CORNER_IMAGE_COORDINATES.topRight,
                ...calibrationDraftCorners.topRight!
            },
            bottomRight: {
                id: 'bottomRight',
                label: CORNER_LABEL.bottomRight,
                ...CORNER_IMAGE_COORDINATES.bottomRight,
                ...calibrationDraftCorners.bottomRight!
            },
            bottomLeft: {
                id: 'bottomLeft',
                label: CORNER_LABEL.bottomLeft,
                ...CORNER_IMAGE_COORDINATES.bottomLeft,
                ...calibrationDraftCorners.bottomLeft!
            }
        });

        setGeoCalibration(result.calibration);
        setShowCalibrateWizard(false);
        setFabMenuOpen(false);
    };

    if (transLoading || guideLoading) {
        return <Loading />;
    }

    if (error) {
        return <div>{t('common.error')}: {error}</div>;
    }

    const canUseTiles = Boolean(data?.mapTileUrlTemplate && data?.mapPixelWidth && data?.mapPixelHeight);

    return (
        <div className="page">
            <GlobalHeader
                title="Draw"
                showBack={false}
                showVersion={false}
                style={{
                    background: 'var(--neutral-100)',
                    borderBottom: 'none'
                }}
                leftSlot={
                    <button
                        onClick={handleBackToView}
                        aria-label="Back to map"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--neutral-800)',
                            fontSize: 32,
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
                    <div style={{ position: 'relative', width: 44, height: 44 }}>
                        {/* Main FAB Button */}
                        <button
                            onClick={() => setFabMenuOpen((prev) => !prev)}
                            aria-label="Menu"
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 999,
                                border: 'none',
                                background: fabMenuOpen ? '#2563eb' : 'rgba(33, 36, 39, 0.15)',
                                color: fabMenuOpen ? '#fff' : 'var(--neutral-800)',
                                fontWeight: 900,
                                fontSize: 24,
                                lineHeight: 1,
                                padding: 0,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            ⋮
                        </button>

                        {/* FAB Menu */}
                        {fabMenuOpen && (
                            <div
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 50,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                    zIndex: 2000
                                }}
                            >
                                <button
                                    onClick={handleExport}
                                    aria-label="Export draw data"
                                    title="Export"
                                    style={{
                                        height: 44,
                                        minWidth: 110,
                                        borderRadius: 12,
                                        border: 'none',
                                        background: '#2563eb',
                                        color: 'rgba(245, 245, 245, 0.98)',
                                        fontWeight: 900,
                                        fontSize: 13,
                                        padding: '0 14px',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Export
                                </button>
                                <button
                                    onClick={handleOpenCalibrationEditor}
                                    disabled={!calibrationTileImageUrl}
                                    aria-label="Calibrate map"
                                    title="Calibrate"
                                    style={{
                                        height: 44,
                                        minWidth: 110,
                                        borderRadius: 12,
                                        border: 'none',
                                        background: 'rgba(168, 85, 247, 0.16)',
                                        color: calibrationTileImageUrl ? '#7c3aed' : 'rgba(124, 58, 237, 0.45)',
                                        fontWeight: 900,
                                        fontSize: 13,
                                        padding: '0 14px',
                                        cursor: calibrationTileImageUrl ? 'pointer' : 'not-allowed',
                                        opacity: calibrationTileImageUrl ? 1 : 0.5,
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Calibrate
                                </button>
                            </div>
                        )}
                    </div>
                }
            />

            <div
                className="scroll-content"
                style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {!canUseTiles ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                        {t('map.noImage')}
                    </div>
                ) : (
                    <>
                        {!showCalibrateWizard && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '50%',
                                    top: 16,
                                    transform: 'translateX(-50%)',
                                    zIndex: 1100,
                                    display: 'inline-flex',
                                    padding: 4,
                                    gap: 4,
                                    borderRadius: 999,
                                    background: 'rgba(245, 245, 245, 0.96)',
                                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.16)'
                                }}
                                >
                                    <button
                                        onClick={() => setDrawLayerMode('pins')}
                                    style={{
                                        border: 'none',
                                        borderRadius: 999,
                                        padding: '8px 12px',
                                        background: drawLayerMode === 'pins' ? '#2563eb' : 'transparent',
                                        color: drawLayerMode === 'pins' ? '#fff' : 'var(--neutral-800)',
                                        fontWeight: 900,
                                        fontSize: 12,
                                        cursor: 'pointer'
                                    }}
                                    >
                                        POI
                                    </button>
                                    <button
                                        onClick={() => setDrawLayerMode('traversable')}
                                    style={{
                                        border: 'none',
                                        borderRadius: 999,
                                        padding: '8px 12px',
                                        background: drawLayerMode === 'traversable' ? '#16a34a' : 'transparent',
                                        color: drawLayerMode === 'traversable' ? '#fff' : 'var(--neutral-800)',
                                        fontWeight: 900,
                                        fontSize: 12,
                                        cursor: 'pointer'
                                    }}
                                    >
                                        Traversable
                                    </button>
                            </div>
                        )}

                        <div style={{ flex: 1, minHeight: 0 }}>
                            <TiledMapDrawer
                                mapTileUrlTemplate={data!.mapTileUrlTemplate!}
                                mapTileMaxZoom={data!.mapTileMaxZoom}
                                mapPixelWidth={data!.mapPixelWidth!}
                                mapPixelHeight={data!.mapPixelHeight!}
                                pins={pins}
                                traversableRegions={traversableRegions}
                                editLayerMode={drawLayerMode}
                                selectedPinId={selectedPinId}
                                selectedTraversableRegionId={selectedTraversableRegionId}
                                pinDisplayNameById={pinDisplayNameById}
                                onPinSelect={setSelectedPinId}
                                onTraversableRegionSelect={setSelectedTraversableRegionId}
                                onPolygonChange={handlePolygonChange}
                                onTraversableRegionPolygonChange={handleTraversableRegionPolygonChange}
                                onMapClick={(point) => {
                                    if (drawLayerMode === 'pins' && movePinMode) {
                                        handleMoveSelectedPin(point);
                                    }
                                }}
                            />
                        </div>

                        {drawLayerMode === 'pins' && movePinMode && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    top: 68,
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    background: 'rgba(245, 158, 11, 0.96)',
                                    color: '#fff',
                                    fontWeight: 900,
                                    fontSize: 12,
                                    zIndex: 1100
                                }}
                            >
                                Tap map to place selected pin
                            </div>
                        )}

                        {!showCalibrateWizard && drawLayerMode === 'pins' && (
                            <button
                                onClick={() => {
                                    handleAddPin();
                                    setFabMenuOpen(false);
                                }}
                                aria-label="Add pin"
                                title="Add Pin"
                                style={{
                                    position: 'absolute',
                                    right: 11,
                                    top: selectedPinId ? 85 : 50,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0,
                                    border: 'solid 1px rgba(0,0,0,0.8)',
                                    background: 'rgba(255, 255, 255, 0.96)',
                                    color: 'var(--neutral-800)',
                                    padding: 0,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.16)',
                                    zIndex: 1100,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Plus size={20} strokeWidth={2.4} />
                            </button>
                        )}

                        {selectedPinId && drawLayerMode === 'pins' && !showCalibrateWizard && (
                            <button
                                onClick={() => {
                                    setMovePinMode((prev) => !prev);
                                    setFabMenuOpen(false);
                                }}
                                aria-label="Move pin display position"
                                title="Move Pin Display"
                                style={{
                                    position: 'absolute',
                                    right: 11,
                                    top: 50,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0,
                                    border: 'solid 1px rgba(0,0,0,0.8)',
                                    background: movePinMode ? '#f59e0b' : 'rgba(255, 255, 255, 0.96)',
                                    color: movePinMode ? '#fff' : 'var(--neutral-800)',
                                    padding: 0,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.16)',
                                    zIndex: 1100,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <MapPinIcon size={20} strokeWidth={2.4} />
                            </button>
                        )}

                        {selectedPinId && drawLayerMode === 'pins' && !showCalibrateWizard && (
                            <button
                                onClick={() => {
                                    setDeleteTarget({ kind: 'pin-region', pinId: selectedPinId });
                                    setFabMenuOpen(false);
                                }}
                                aria-label="Delete POI region"
                                title="Delete POI Region"
                                style={{
                                    position: 'absolute',
                                    right: 11,
                                    top: 120,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0,
                                    border: 'solid 1px rgba(0,0,0,0.8)',
                                    background: 'rgba(255, 255, 255, 0.96)',
                                    color: '#dc2626',
                                    padding: 0,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.16)',
                                    zIndex: 1100,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Trash2 size={18} strokeWidth={2.4} />
                            </button>
                        )}

                        {!showCalibrateWizard && drawLayerMode === 'traversable' && (
                            <button
                                onClick={() => {
                                    handleAddTraversableRegion();
                                    setFabMenuOpen(false);
                                }}
                                aria-label="Add traversable region"
                                title="Add Traversable Region"
                                style={{
                                    position: 'absolute',
                                    right: 11,
                                    top: 50,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0,
                                    border: 'solid 1px rgba(0,0,0,0.8)',
                                    background: 'rgba(255, 255, 255, 0.96)',
                                    color: 'var(--neutral-800)',
                                    padding: 0,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.16)',
                                    zIndex: 1100,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Plus size={20} strokeWidth={2.4} />
                            </button>
                        )}

                        {selectedTraversableRegionId && drawLayerMode === 'traversable' && !showCalibrateWizard && (
                            <button
                                onClick={() => {
                                    setDeleteTarget({ kind: 'traversable-region', regionId: selectedTraversableRegionId });
                                    setFabMenuOpen(false);
                                }}
                                aria-label="Delete traversable region"
                                title="Delete Traversable Region"
                                style={{
                                    position: 'absolute',
                                    right: 11,
                                    top: 85,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 0,
                                    border: 'solid 1px rgba(0,0,0,0.8)',
                                    background: 'rgba(255, 255, 255, 0.96)',
                                    color: '#dc2626',
                                    padding: 0,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.16)',
                                    zIndex: 1100,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Trash2 size={18} strokeWidth={2.4} />
                            </button>
                        )}

                        {showCalibrateWizard && calibrationTileImageUrl && (
                            <div
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    background: 'rgba(15, 23, 42, 0.42)',
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    justifyContent: 'center',
                                    zIndex: 3200,
                                    padding: 10
                                }}
                                onClick={() => setShowCalibrateWizard(false)}
                            >
                                <div
                                    style={{
                                        width: 'min(1080px, 100%)',
                                        height: 'calc(100dvh - 20px)',
                                        maxHeight: 'calc(100dvh - 20px)',
                                        background: 'rgba(255, 255, 255, 0.985)',
                                        borderRadius: 20,
                                        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
                                        padding: 10,
                                        display: 'grid',
                                        gridTemplateRows: 'auto auto auto minmax(0, 1fr) auto',
                                        gap: 8,
                                        overflow: 'hidden'
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <div>
                                            <div style={{ fontWeight: 900, color: 'var(--neutral-900)' }}>
                                                Calibrate Overlay ({completedCorners}/4)
                                            </div>
                                            <div style={{ marginTop: 2, fontSize: 12, color: 'var(--neutral-700)' }}>
                                                Choose a corner with a re-position button, then click the real map to place it.
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowCalibrateWizard(false)}
                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, fontWeight: 900, color: 'var(--neutral-800)', padding: 2 }}
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--neutral-600)', marginBottom: 2 }}>
                                                Overlay opacity
                                            </div>
                                            <input
                                                type="range"
                                                min="0.2"
                                                max="0.9"
                                                step="0.02"
                                                value={calibrationOverlayOpacity}
                                                onChange={(event) => setCalibrationOverlayOpacity(Number(event.target.value))}
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gap: 2, fontSize: 11, color: 'var(--neutral-700)' }}>
                                            {geoCalibration && (
                                                <div>
                                                    Saved calibration: {geoCalibration.points.length} points, RMS {calibrationRmsText} m
                                                </div>
                                            )}
                                            <div>Blue: top-left, cyan: top-right, green: bottom-right, orange: bottom-left.</div>
                                            <div>
                                                {calibrationActiveCorner
                                                    ? <>Pending placement: <strong>{CORNER_LABEL[calibrationActiveCorner]}</strong>. Click anywhere on the map to place it.</>
                                                    : 'No corner is armed. Click a re-position button first.'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as CornerKey[]).map((key) => (
                                            <button
                                                key={key}
                                                onClick={() => setCalibrationActiveCorner((prev) => (prev === key ? null : key))}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: 9,
                                                    border: 'none',
                                                    background: calibrationActiveCorner === key ? 'rgba(37,99,235,0.96)' : 'rgba(33, 36, 39, 0.12)',
                                                    color: calibrationActiveCorner === key ? '#fff' : 'var(--neutral-800)',
                                                    fontWeight: 900,
                                                    fontSize: 11,
                                                    lineHeight: 1.2,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    flex: '0 0 auto'
                                                }}
                                            >
                                                {calibrationActiveCorner === key ? `Picking ${CORNER_LABEL[key]}` : CORNER_LABEL[key]}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ minHeight: 0, height: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(33, 36, 39, 0.12)' }}>
                                        <GeoCalibrationOverlayEditor
                                            imageUrl={calibrationTileImageUrl}
                                            corners={calibrationDraftCorners}
                                            onCornersChange={setCalibrationDraftCorners}
                                            activeCorner={calibrationActiveCorner}
                                            onMapPick={handleCalibrationMapPick}
                                            seedVersion={calibrationSeedVersion}
                                            seedPoints={calibrationSeedPoints}
                                            overlayOpacity={calibrationOverlayOpacity}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                        <div style={{ display: 'grid', gap: 2, fontSize: 10, color: 'var(--neutral-700)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 10 }}>
                                            {CORNER_ORDER.map((key) => {
                                                const point = calibrationDraftCorners[key];
                                                return (
                                                    <div key={key}>
                                                        {CORNER_LABEL[key]}: {point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : 'Pending'}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                onClick={handleResetCalibrationEditor}
                                                style={{ padding: '7px 12px', borderRadius: 9, border: 'none', background: 'rgba(239,68,68,0.82)', color: '#fff', fontWeight: 900, fontSize: 12 }}
                                            >
                                                Reset
                                            </button>
                                            <button
                                                onClick={() => setShowCalibrateWizard(false)}
                                                style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid rgba(33,36,39,0.14)', background: '#fff', color: 'var(--neutral-800)', fontWeight: 900, fontSize: 12 }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleBuildCalibration}
                                                disabled={!canFinish}
                                                style={{
                                                    padding: '7px 12px',
                                                    borderRadius: 9,
                                                    border: 'none',
                                                    background: canFinish ? '#16a34a' : 'rgba(22, 163, 74, 0.25)',
                                                    color: '#fff',
                                                    fontWeight: 900,
                                                    fontSize: 12,
                                                    cursor: canFinish ? 'pointer' : 'not-allowed'
                                                }}
                                            >
                                                Save Calibration
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {deleteTarget && (
                            <div
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    background: 'rgba(15, 23, 42, 0.42)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 3300,
                                    padding: 16
                                }}
                                onClick={() => setDeleteTarget(null)}
                            >
                                <div
                                    style={{
                                        width: 'min(360px, 100%)',
                                        background: 'rgba(255, 255, 255, 0.985)',
                                        borderRadius: 18,
                                        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
                                        padding: 18,
                                        display: 'grid',
                                        gap: 12
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--neutral-900)' }}>
                                        Confirm Delete
                                    </div>
                                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--neutral-700)' }}>
                                        {deleteTarget.kind === 'pin-region'
                                            ? 'Delete the selected POI region? The pin display position will be kept.'
                                            : 'Delete the selected traversable region?'}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                        <button
                                            onClick={() => setDeleteTarget(null)}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: 10,
                                                border: '1px solid rgba(33,36,39,0.14)',
                                                background: '#fff',
                                                color: 'var(--neutral-800)',
                                                fontWeight: 900,
                                                fontSize: 12
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmDelete}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: 10,
                                                border: 'none',
                                                background: '#dc2626',
                                                color: '#fff',
                                                fontWeight: 900,
                                                fontSize: 12
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                padding: '10px 12px calc(env(safe-area-inset-bottom) + 10px)',
                                background: 'linear-gradient(180deg, rgba(245,245,245,0) 0%, rgba(245,245,245,0.94) 36%, rgba(245,245,245,0.98) 100%)',
                                zIndex: 1000
                            }}
                        >
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 8,
                                    overflowX: 'auto',
                                    paddingBottom: 4,
                                        alignItems: 'center'
                                    }}
                                >
                                    {drawLayerMode === 'pins' && pins.map((pin) => {
                                        const isSelected = pin.id === selectedPinId;
                                        const title = pinDisplayNameById[pin.id] || pin.id;
                                        const hasPolygon = Array.isArray(pin.polygon) && pin.polygon.length >= 3;
                                        return (
                                            <button
                                                key={pin.id}
                                                onClick={() => setSelectedPinId(isSelected ? null : pin.id)}
                                                style={{
                                                    border: 'none',
                                                    borderRadius: 999,
                                                    padding: '10px 14px',
                                                    whiteSpace: 'nowrap',
                                                    background: isSelected ? '#2563eb' : 'rgba(33, 36, 39, 0.12)',
                                                    color: isSelected ? '#f5f5f5' : 'var(--neutral-800)',
                                                    fontWeight: 900,
                                                    fontSize: 12,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <span>{isSelected ? `× ${title}` : title}</span>
                                                <span
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: 999,
                                                        background: hasPolygon ? '#22c55e' : (isSelected ? 'rgba(245,245,245,0.65)' : 'rgba(33,36,39,0.35)')
                                                    }}
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        );
                                    })}

                                    {drawLayerMode === 'traversable' && traversableRegions.map((region) => {
                                        const isSelected = region.id === selectedTraversableRegionId;
                                        const title = getTraversableRegionTitle(region.id);
                                        const hasPolygon = Array.isArray(region.polygon) && region.polygon.length >= 3;
                                        return (
                                            <button
                                                key={region.id}
                                                onClick={() => setSelectedTraversableRegionId(isSelected ? null : region.id)}
                                                style={{
                                                    border: 'none',
                                                    borderRadius: 999,
                                                    padding: '10px 14px',
                                                    whiteSpace: 'nowrap',
                                                    background: isSelected ? '#16a34a' : 'rgba(33, 36, 39, 0.12)',
                                                    color: isSelected ? '#f5f5f5' : 'var(--neutral-800)',
                                                    fontWeight: 900,
                                                    fontSize: 12,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <span>{isSelected ? `× ${title}` : title}</span>
                                                <span
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: 999,
                                                        background: hasPolygon ? '#22c55e' : (isSelected ? 'rgba(245,245,245,0.65)' : 'rgba(33,36,39,0.35)')
                                                    }}
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        );
                                    })}
                                    {drawLayerMode === 'traversable' && traversableRegions.length === 0 && (
                                        <div
                                            style={{
                                                color: 'var(--neutral-700)',
                                                fontWeight: 800,
                                                fontSize: 12,
                                                padding: '10px 14px'
                                            }}
                                        >
                                            Add a traversable region, then use Draw Polygon.
                                        </div>
                                    )}
                                    {drawLayerMode === 'traversable' && traversableRegions.length > 0 && !selectedTraversableRegionId && (
                                        <div
                                            style={{
                                                color: 'var(--neutral-700)',
                                                fontWeight: 800,
                                                fontSize: 12,
                                                padding: '10px 14px'
                                            }}
                                        >
                                            Select a traversable region chip to redraw it.
                                        </div>
                                    )}
                                    {drawLayerMode === 'pins' && pins.length === 0 && (
                                        <div
                                            style={{
                                                color: 'var(--neutral-700)',
                                                fontWeight: 800,
                                                fontSize: 12,
                                                padding: '10px 14px'
                                            }}
                                        >
                                            Add a pin to start drawing POI regions.
                                        </div>
                                    )}
                            </div>
                        </div>
                    </>
                )}

                {pinsError && (
                    <div
                        style={{
                            position: 'absolute',
                            left: 16,
                            right: 16,
                            top: 16,
                            background: 'rgba(245, 245, 245, 0.95)',
                            color: 'var(--neutral-700)',
                            padding: '10px 12px',
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 12,
                            zIndex: 1100
                        }}
                    >
                        {t('common.error')}: {pinsError}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuideMapDraw;
