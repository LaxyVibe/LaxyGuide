import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MapPin as MapPinIcon, Plus, Trash2 } from 'lucide-react';
import GeoCalibrationOverlayEditor from '../components/GeoCalibrationOverlayEditor';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapAssetLoadingBar from '../components/MapAssetLoadingBar';
import TiledMapDrawer from '../components/TiledMapDrawer';
import { useGuideData } from '../hooks/useGuideData';
import { useMapTileBundle } from '../hooks/useMapTileBundle';
import { useTranslation } from '../hooks/useTranslation';
import type { GeoCalibration, MapAuthoringDocument, MapPin, MapPinsFile, TraversableRegion, TraversableRegionsFile } from '../types';
import { getCurrentFirebaseUser, isFirebaseAuthConfigured, subscribeToFirebaseAuth } from '../utils/firebaseAuth';
import {
    createBootstrapMapAuthoringDocument,
    fetchMapAuthoringJson,
    isMapAuthoringEnabledGuide,
    normalizeMapAuthoringDocument,
    saveMapAuthoringJson
} from '../utils/mapDrawData';
import { fetchPinsFile } from '../utils/mapPins';
import { resolveBundledTileUrl, type ResolvedMapTileBundle } from '../utils/mapTileBundle';
import { getNextNumericId } from '../utils/pinIdUtils';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import { buildCornerBilinearCalibration, transformNormalizedPoint, type GeoPoint } from '../utils/geoTransform';
import {
    normalizeTraversableRegionsForEditor,
    updateTraversableRegionPolygonForEditor
} from '../utils/mapDrawTraversableRegions.ts';
import {
    CORNER_IMAGE_COORDINATES,
    CORNER_LABEL,
    CORNER_ORDER,
    formatCalibrationCornerStatus,
    getCalibrationDraftCorners,
    type CalibrationDraftCorners
} from '../utils/mapCalibration.ts';
import './GuideMapDraw.css';

type DrawLayerMode = 'pins' | 'traversable';
type DeleteTarget =
    | { kind: 'pin-region'; pinId: string }
    | { kind: 'traversable-region'; regionId: string }
    | null;

const TILE_SIZE = 256;

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

function resolveTileUrlForCalibration(
    mapTileMaxZoom: number,
    x: number,
    y: number,
    options: {
        mapTileUrlTemplate?: string;
        mapTileBundle?: ResolvedMapTileBundle | null;
    }
) {
    if (options.mapTileBundle) {
        return resolveBundledTileUrl(options.mapTileBundle, mapTileMaxZoom, x, y) || null;
    }

    if (!options.mapTileUrlTemplate) {
        return null;
    }

    return buildTileUrl(options.mapTileUrlTemplate, mapTileMaxZoom, x, y);
}

async function buildCalibrationImageFromTiles(
    options: {
        mapTileUrlTemplate?: string;
        mapTileBundle?: ResolvedMapTileBundle | null;
    },
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
            const tileUrl = resolveTileUrlForCalibration(mapTileMaxZoom, x, y, options);
            if (!tileUrl) continue;
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
    const [calibrationDraftCorners, setCalibrationDraftCorners] = useState<CalibrationDraftCorners>({});
    const [calibrationSeedVersion, setCalibrationSeedVersion] = useState(0);
    const [calibrationOverlayOpacity, setCalibrationOverlayOpacity] = useState(0.62);
    const [calibrationTileImageUrl, setCalibrationTileImageUrl] = useState<string | null>(null);
    const [geoCalibration, setGeoCalibration] = useState<GeoCalibration | null>(null);
    const [mapDrawExporting, setMapDrawExporting] = useState(false);
    const [mapDrawExportStatus, setMapDrawExportStatus] = useState<string | null>(null);
    const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
    const canUploadMapDraw = isMapAuthoringEnabledGuide(guideId);
    const firebaseAuthConfigured = isFirebaseAuthConfigured();
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
    const effectiveMapTileBundle = resolvedMapTileBundle;
    const effectiveMapTileUrlTemplate = hasHostedMapBundle
        ? effectiveMapTileBundle?.manifest.tilePathTemplate
        : data?.mapTileUrlTemplate;
    const effectiveMapTileMaxZoom = hasHostedMapBundle
        ? effectiveMapTileBundle?.manifest.mapTileMaxZoom
        : data?.mapTileMaxZoom;
    const effectiveMapPixelWidth = hasHostedMapBundle
        ? effectiveMapTileBundle?.manifest.mapPixelWidth
        : data?.mapPixelWidth;
    const effectiveMapPixelHeight = hasHostedMapBundle
        ? effectiveMapTileBundle?.manifest.mapPixelHeight
        : data?.mapPixelHeight;
    const editorMapGeometry = useMemo(() => {
        if (!effectiveMapPixelWidth || !effectiveMapPixelHeight) {
            return null;
        }

        return {
            mapPixelWidth: effectiveMapPixelWidth,
            mapPixelHeight: effectiveMapPixelHeight,
            mapTileMaxZoom: effectiveMapTileMaxZoom ?? 5
        };
    }, [effectiveMapPixelHeight, effectiveMapPixelWidth, effectiveMapTileMaxZoom]);

    useEffect(() => {
        let cancelled = false;

        const loadBootstrapDocument = async (nextGuideId: string): Promise<MapAuthoringDocument> => {
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
                traversableRegions: createEmptyTraversableRegionsFile(nextGuideId)
            });
        };

        const applyAuthoringDocument = (document: MapAuthoringDocument) => {
            const normalizedDocument = normalizeMapAuthoringDocument(document, document.guideId);
            const nextPinsFile: MapPinsFile = {
                version: 2,
                guideId: normalizedDocument.guideId,
                pins: normalizedDocument.pins
            };
            const nextTraversableFile = normalizeTraversableRegionsForEditor(
                {
                    version: 1,
                    guideId: normalizedDocument.guideId,
                    regions: normalizedDocument.traversableRegions
                },
                editorMapGeometry
            );

            setPinsFile(nextPinsFile);
            setTraversableRegionsFile(nextTraversableFile);
            setGeoCalibration(normalizedDocument.calibration ?? null);
            setSelectedPinId((prev) => {
                if (prev && nextPinsFile.pins.some((pin) => pin.id === prev)) return prev;
                return nextPinsFile.pins[0]?.id ?? null;
            });
            setSelectedTraversableRegionId((prev) => {
                if (prev && nextTraversableFile.regions.some((region) => region.id === prev)) return prev;
                return nextTraversableFile.regions[0]?.id ?? null;
            });
        };

        const run = async () => {
            setPinsError(null);
            if (!guideId) {
                setPinsFile(null);
                setTraversableRegionsFile(null);
                setGeoCalibration(null);
                return;
            }

            try {
                const remoteDocument = canUploadMapDraw
                    ? await fetchMapAuthoringJson(guideId)
                    : null;
                if (cancelled) return;

                if (remoteDocument) {
                    applyAuthoringDocument(remoteDocument);
                    return;
                }

                const bootstrapDocument = await loadBootstrapDocument(guideId);
                if (cancelled) return;
                applyAuthoringDocument(bootstrapDocument);
            } catch (e) {
                if (!cancelled) {
                    setPinsError(e instanceof Error ? e.message : String(e));
                    const bootstrapDocument = await loadBootstrapDocument(guideId);
                    if (cancelled) return;
                    applyAuthoringDocument(bootstrapDocument);
                }
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [canUploadMapDraw, data?.geoCalibration, data?.mapPinsUrl, editorMapGeometry, guideId]);

    useEffect(() => {
        let cancelled = false;

        const clearCurrentImage = () => {
            setCalibrationTileImageUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        };

        const run = async () => {
            const shouldUseHostedBundle = hasHostedMapBundle;
            if (shouldUseHostedBundle && !resolvedMapTileBundle) {
                clearCurrentImage();
                return;
            }

            const template = shouldUseHostedBundle
                ? resolvedMapTileBundle?.manifest.tilePathTemplate
                : data?.mapTileUrlTemplate;
            const maxZoom = shouldUseHostedBundle
                ? resolvedMapTileBundle?.manifest.mapTileMaxZoom
                : data?.mapTileMaxZoom;
            const pixelWidth = shouldUseHostedBundle
                ? resolvedMapTileBundle?.manifest.mapPixelWidth
                : data?.mapPixelWidth;
            const pixelHeight = shouldUseHostedBundle
                ? resolvedMapTileBundle?.manifest.mapPixelHeight
                : data?.mapPixelHeight;

            if (!template || !Number.isFinite(pixelWidth) || !Number.isFinite(pixelHeight)) {
                clearCurrentImage();
                return;
            }

            clearCurrentImage();

            try {
                const nextUrl = await buildCalibrationImageFromTiles(
                    {
                        mapTileUrlTemplate: template,
                        mapTileBundle: resolvedMapTileBundle
                    },
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
    }, [
        data?.mapTileMaxZoom,
        data?.mapPixelWidth,
        data?.mapPixelHeight,
        data?.mapTileUrlTemplate,
        hasHostedMapBundle,
        resolvedMapTileBundle
    ]);

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

    useEffect(() => {
        if (!canUploadMapDraw || !firebaseAuthConfigured) {
            setSignedInEmail(null);
            return;
        }

        return subscribeToFirebaseAuth((user) => {
            setSignedInEmail(user?.email ?? null);
        });
    }, [canUploadMapDraw, firebaseAuthConfigured]);

    useEffect(() => {
        if (!canUploadMapDraw) {
            setMapDrawExportStatus(null);
        }
    }, [canUploadMapDraw]);

    const pinDisplayNameById = useMemo(() => {
        const byNumber = new Map((data?.pois ?? []).map((poi) => [poi.number, poi.title]));
        const out: Record<string, string> = {};
        for (const pin of pins) {
            out[pin.id] = byNumber.get(pin.id) || pin.id;
        }
        return out;
    }, [pins, data?.pois]);

    const selectedPin = useMemo(
        () => pins.find((pin) => pin.id === selectedPinId) ?? null,
        [pins, selectedPinId]
    );
    const selectedTraversableRegion = useMemo(
        () => traversableRegions.find((region) => region.id === selectedTraversableRegionId) ?? null,
        [selectedTraversableRegionId, traversableRegions]
    );

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
                return next;
            });
        },
        [guideId]
    );

    const handleTraversableRegionPolygonChange = React.useCallback(
        (regionId: string, polygon: Array<{ lat: number; lng: number }> | undefined) => {
            if (!guideId) return;
            if (!editorMapGeometry) return;
            setTraversableRegionsFile((prev) => {
                const base = prev ?? createEmptyTraversableRegionsFile(guideId);
                return updateTraversableRegionPolygonForEditor({
                    file: base,
                    guideId,
                    regionId,
                    polygon,
                    geometry: editorMapGeometry
                });
            });
        },
        [editorMapGeometry, guideId]
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
            polygon: [],
            polygonNormalized: [],
            geoPolygon: []
        };

        const next: TraversableRegionsFile = {
            version: 1,
            guideId,
            regions: [...currentRegions, nextRegion]
        };

        setTraversableRegionsFile(next);
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

    const handleSave = React.useCallback(async () => {
        if (!guideId || !canUploadMapDraw) return;

        if (!firebaseAuthConfigured) {
            setMapDrawExportStatus(t('map.drawAuthNotConfigured', 'Firebase auth is not configured'));
            setFabMenuOpen(false);
            return;
        }

        setFabMenuOpen(false);
        setMapDrawExporting(true);

        try {
            const user = getCurrentFirebaseUser();
            if (!user) {
                throw new Error(t('map.drawSessionExpired', 'Your sign-in session expired. Please reopen the editor and sign in again.'));
            }
            const idToken = await user.getIdToken();

            const nextTraversableRegions = (traversableRegionsFile?.regions ?? []).map((region) => ({
                ...region,
                geoPolygon: geoCalibration && Array.isArray(region.polygonNormalized) && region.polygonNormalized.length >= 3
                    ? region.polygonNormalized.map((point) => transformNormalizedPoint(geoCalibration.transform, point))
                    : region.geoPolygon
            }));
            const payload = normalizeMapAuthoringDocument(
                {
                    guideId,
                    calibration: geoCalibration ?? null,
                    pins: pinsFile?.pins ?? [],
                    traversableRegions: nextTraversableRegions
                },
                guideId
            );

            setMapDrawExportStatus(t('map.drawUploading', 'Saving map authoring JSON...'));
            await saveMapAuthoringJson({ guideId, payload, idToken });
            setTraversableRegionsFile(normalizeTraversableRegionsForEditor(
                {
                    version: 1,
                    guideId,
                    regions: payload.traversableRegions
                },
                editorMapGeometry
            ));
            setGeoCalibration(payload.calibration);
            setSignedInEmail(user.email ?? null);
            setMapDrawExportStatus(t('map.drawUploaded', 'Map authoring JSON saved'));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setMapDrawExportStatus(`${t('map.drawUploadFailed', 'Map draw upload failed')}: ${message}`);
        } finally {
            setMapDrawExporting(false);
        }
    }, [
        canUploadMapDraw,
        editorMapGeometry,
        firebaseAuthConfigured,
        geoCalibration,
        guideId,
        pinsFile?.pins,
        t,
        traversableRegionsFile?.regions
    ]);

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
            if (!geoCalibration) continue;
            for (const point of region.polygonNormalized ?? []) {
                const geoPoint = transformNormalizedPoint(geoCalibration.transform, point);
                if (Number.isFinite(geoPoint.lat) && Number.isFinite(geoPoint.lng)) {
                    points.push(geoPoint);
                }
            }
        }
        return points;
    }, [geoCalibration, pins, traversableRegions]);

    const completedCorners = CORNER_ORDER.filter((key) => Boolean(calibrationDraftCorners[key])).length;
    const canFinish = CORNER_ORDER.every((key) => Boolean(calibrationDraftCorners[key]));
    const calibrationRmsText = geoCalibration?.method === 'affine'
        ? (geoCalibration.rmsErrorMeters?.toFixed(2) ?? 'n/a')
        : 'n/a';

    const handleOpenCalibrationEditor = React.useCallback(() => {
        const calibration = geoCalibration ?? data?.geoCalibration ?? null;
        setCalibrationDraftCorners(getCalibrationDraftCorners(calibration));
        setCalibrationSeedVersion((prev) => prev + 1);
        setShowCalibrateWizard(true);
        setFabMenuOpen(false);
    }, [geoCalibration, data?.geoCalibration]);

    const handleResetCalibrationEditor = React.useCallback(() => {
        setCalibrationDraftCorners({});
        setCalibrationSeedVersion((prev) => prev + 1);
    }, []);

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

    const shouldWaitForTileBundle = hasHostedMapBundle && mapTileBundleLoading;

    if (transLoading || guideLoading) {
        return <Loading />;
    }

    if (error) {
        return <div>{t('common.error')}: {error}</div>;
    }

    const canUseTiles = Boolean(effectiveMapTileUrlTemplate && effectiveMapPixelWidth && effectiveMapPixelHeight);

    return (
        <div className="page map-draw-page">
            <GlobalHeader
                title="Map Authoring"
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
                    <div className="map-draw-toolbar">
                        <div className="map-draw-toolbar-desktop">
                            <div className="map-draw-layer-switch map-draw-layer-switch--toolbar">
                                <button
                                    onClick={() => setDrawLayerMode('pins')}
                                    className={`map-draw-layer-switch__button${drawLayerMode === 'pins' ? ' is-active' : ''}`}
                                >
                                    POI Layer
                                </button>
                                <button
                                    onClick={() => setDrawLayerMode('traversable')}
                                    className={`map-draw-layer-switch__button map-draw-layer-switch__button--traversable${drawLayerMode === 'traversable' ? ' is-active' : ''}`}
                                >
                                    Traversable
                                </button>
                            </div>
                            <button
                                onClick={handleOpenCalibrationEditor}
                                disabled={!calibrationTileImageUrl}
                                aria-label="Calibrate map"
                                title="Calibrate"
                                className="map-draw-toolbar-button map-draw-toolbar-button--calibrate"
                            >
                                Calibrate
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={mapDrawExporting || !canUploadMapDraw}
                                aria-label="Save draw data"
                                title={canUploadMapDraw ? 'Save to Firebase' : 'Save is only enabled for Firebase-backed guides'}
                                className="map-draw-toolbar-button map-draw-toolbar-button--save"
                            >
                                {mapDrawExporting ? 'Saving...' : 'Save'}
                            </button>
                        </div>

                        <div className="map-draw-toolbar-mobile">
                            <button
                                onClick={handleSave}
                                disabled={mapDrawExporting || !canUploadMapDraw}
                                aria-label="Save draw data"
                                title={canUploadMapDraw ? 'Save to Firebase' : 'Save is only enabled for Firebase-backed guides'}
                                className="map-draw-toolbar-button map-draw-toolbar-button--save"
                            >
                                {mapDrawExporting ? 'Saving...' : 'Save'}
                            </button>
                            <div style={{ position: 'relative', width: 44, height: 44 }}>
                                <button
                                    onClick={() => setFabMenuOpen((prev) => !prev)}
                                    aria-label="Menu"
                                    className="map-draw-toolbar-menu-button"
                                >
                                    ⋮
                                </button>

                                {fabMenuOpen && (
                                    <div className="map-draw-toolbar-menu">
                                        <button
                                            onClick={handleOpenCalibrationEditor}
                                            disabled={!calibrationTileImageUrl}
                                            aria-label="Calibrate map"
                                            title="Calibrate"
                                            className="map-draw-toolbar-menu-item"
                                        >
                                            Calibrate
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                }
            />

            <div
                className="scroll-content map-draw-scroll"
                style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {(mapDrawExportStatus || (canUploadMapDraw && signedInEmail)) && (
                    <div
                        className="map-draw-status-banner map-draw-mobile-only"
                        style={{
                            margin: '10px 16px 0',
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: '#1d4ed8',
                            fontWeight: 800,
                            fontSize: 12
                        }}
                    >
                        {mapDrawExportStatus ?? `Signed in as ${signedInEmail}`}
                    </div>
                )}
                {shouldWaitForTileBundle ? (
                    <MapAssetLoadingBar />
                ) : !canUseTiles ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                        {t('map.noImage')}
                    </div>
                ) : (
                    <>
                        <div className="map-draw-workspace">
                            <aside className="map-draw-desktop-sidebar map-draw-desktop-only">
                                <div className="map-draw-desktop-card">
                                    <div className="map-draw-desktop-card__header">
                                        <div>
                                            <div className="map-draw-desktop-label">POI Pins</div>
                                            <div className="map-draw-desktop-title">Authoring targets</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                handleAddPin();
                                                setFabMenuOpen(false);
                                            }}
                                            className="map-draw-desktop-action map-draw-desktop-action--primary"
                                        >
                                            Add Pin
                                        </button>
                                    </div>
                                    <div className="map-draw-desktop-list">
                                        {pins.length === 0 ? (
                                            <div className="map-draw-desktop-empty">Add a pin to start drawing POI regions.</div>
                                        ) : pins.map((pin) => {
                                            const isSelected = pin.id === selectedPinId;
                                            const title = pinDisplayNameById[pin.id] || pin.id;
                                            const hasPolygon = Array.isArray(pin.polygon) && pin.polygon.length >= 3;
                                            return (
                                                <button
                                                    key={pin.id}
                                                    onClick={() => {
                                                        setDrawLayerMode('pins');
                                                        setSelectedPinId(isSelected ? null : pin.id);
                                                    }}
                                                    className={`map-draw-desktop-list-button${isSelected ? ' is-selected is-pins' : ''}`}
                                                >
                                                    <span>{title}</span>
                                                    <span className={`map-draw-desktop-indicator${hasPolygon ? ' is-complete' : ''}`} aria-hidden="true" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="map-draw-desktop-card">
                                    <div className="map-draw-desktop-card__header">
                                        <div>
                                            <div className="map-draw-desktop-label">Traversable Areas</div>
                                            <div className="map-draw-desktop-title">Walkable geometry</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                handleAddTraversableRegion();
                                                setFabMenuOpen(false);
                                            }}
                                            className="map-draw-desktop-action map-draw-desktop-action--secondary"
                                        >
                                            Add Region
                                        </button>
                                    </div>
                                    <div className="map-draw-desktop-list">
                                        {traversableRegions.length === 0 ? (
                                            <div className="map-draw-desktop-empty">Create a traversable region to define where GPS can snap.</div>
                                        ) : traversableRegions.map((region) => {
                                            const isSelected = region.id === selectedTraversableRegionId;
                                            const hasPolygon = Array.isArray(region.polygon) && region.polygon.length >= 3;
                                            return (
                                                <button
                                                    key={region.id}
                                                    onClick={() => {
                                                        setDrawLayerMode('traversable');
                                                        setSelectedTraversableRegionId(isSelected ? null : region.id);
                                                    }}
                                                    className={`map-draw-desktop-list-button${isSelected ? ' is-selected is-traversable' : ''}`}
                                                >
                                                    <span>{getTraversableRegionTitle(region.id)}</span>
                                                    <span className={`map-draw-desktop-indicator${hasPolygon ? ' is-complete' : ''}`} aria-hidden="true" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </aside>

                            <div className="map-draw-stage-shell">
                                <div className="map-draw-canvas-stage">
                        {!showCalibrateWizard && (
                            <div
                                className="map-draw-mobile-only"
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

                        <div className="map-draw-canvas-body" style={{ flex: 1, minHeight: 0 }}>
                            <TiledMapDrawer
                                mapTileUrlTemplate={effectiveMapTileUrlTemplate!}
                                mapTileBundle={effectiveMapTileBundle ?? undefined}
                                mapTileMaxZoom={effectiveMapTileMaxZoom}
                                mapPixelWidth={effectiveMapPixelWidth!}
                                mapPixelHeight={effectiveMapPixelHeight!}
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
                                className="map-draw-mobile-only"
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
                                className="map-draw-mobile-only"
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
                                className="map-draw-mobile-only"
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
                                className="map-draw-mobile-only"
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
                                className="map-draw-mobile-only"
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
                                className="map-draw-mobile-only"
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
                                                Drag the colored corner handles to align the overlay with the real map.
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
                                            <div>Drag any corner handle to refine the warped overlay before saving.</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {CORNER_ORDER.map((key) => (
                                            <div
                                                key={key}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: 9,
                                                    border: '1px solid rgba(33, 36, 39, 0.12)',
                                                    background: 'rgba(33, 36, 39, 0.04)',
                                                    color: 'var(--neutral-800)',
                                                    fontWeight: 800,
                                                    fontSize: 11,
                                                    lineHeight: 1.2,
                                                    whiteSpace: 'nowrap',
                                                    flex: '0 0 auto'
                                                }}
                                            >
                                                {formatCalibrationCornerStatus(key, calibrationDraftCorners)}
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ minHeight: 0, height: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(33, 36, 39, 0.12)' }}>
                                        <GeoCalibrationOverlayEditor
                                            imageUrl={calibrationTileImageUrl}
                                            corners={calibrationDraftCorners}
                                            onCornersChange={setCalibrationDraftCorners}
                                            seedVersion={calibrationSeedVersion}
                                            seedPoints={calibrationSeedPoints}
                                            overlayOpacity={calibrationOverlayOpacity}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
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
                            className="map-draw-mobile-only"
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
                                </div>
                            </div>

                            <aside className="map-draw-desktop-sidebar map-draw-desktop-sidebar--secondary map-draw-desktop-only">
                                <div className="map-draw-desktop-card">
                                    <div className="map-draw-desktop-label">Workspace Status</div>
                                    <div className="map-draw-desktop-title">Session and publish state</div>
                                    <div className="map-draw-desktop-note">
                                        {signedInEmail ? `Signed in as ${signedInEmail}` : 'Protected authoring route'}
                                    </div>
                                    <div className={`map-draw-desktop-status${mapDrawExportStatus ? ' is-active' : ''}`}>
                                        {mapDrawExportStatus ?? 'Ready to edit. Save writes the current authoring JSON to Firebase.'}
                                    </div>
                                </div>

                                <div className="map-draw-desktop-card">
                                    <div className="map-draw-desktop-label">Current Tool</div>
                                    <div className="map-draw-desktop-title">
                                        {drawLayerMode === 'pins' ? 'POI region editing' : 'Traversable region editing'}
                                    </div>
                                    <div className="map-draw-desktop-note">
                                        {drawLayerMode === 'pins'
                                            ? 'Select a POI, draw its region on the map, and adjust the display pin when needed.'
                                            : 'Select a region, redraw its polygon, and save to update GPS snapping boundaries.'}
                                    </div>
                                    {drawLayerMode === 'pins' && selectedPin && (
                                        <div className="map-draw-desktop-selection">
                                            <div className="map-draw-desktop-selection__title">{pinDisplayNameById[selectedPin.id] || selectedPin.id}</div>
                                            <div className="map-draw-desktop-selection__meta">
                                                {Array.isArray(selectedPin.polygon) && selectedPin.polygon.length >= 3
                                                    ? 'Region polygon complete'
                                                    : 'Region polygon not drawn yet'}
                                            </div>
                                            <div className="map-draw-desktop-actions">
                                                <button
                                                    onClick={() => setMovePinMode((prev) => !prev)}
                                                    className={`map-draw-desktop-action${movePinMode ? ' is-warning' : ''}`}
                                                >
                                                    {movePinMode ? 'Tap map to place pin' : 'Move Pin Display'}
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget({ kind: 'pin-region', pinId: selectedPin.id })}
                                                    className="map-draw-desktop-action map-draw-desktop-action--danger"
                                                >
                                                    Delete POI Region
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {drawLayerMode === 'traversable' && selectedTraversableRegion && (
                                        <div className="map-draw-desktop-selection">
                                            <div className="map-draw-desktop-selection__title">{getTraversableRegionTitle(selectedTraversableRegion.id)}</div>
                                            <div className="map-draw-desktop-selection__meta">
                                                {Array.isArray(selectedTraversableRegion.polygon) && selectedTraversableRegion.polygon.length >= 3
                                                    ? 'Polygon complete'
                                                    : 'Polygon not drawn yet'}
                                            </div>
                                            <div className="map-draw-desktop-actions">
                                                <button
                                                    onClick={() => setDeleteTarget({ kind: 'traversable-region', regionId: selectedTraversableRegion.id })}
                                                    className="map-draw-desktop-action map-draw-desktop-action--danger"
                                                >
                                                    Delete Region
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {drawLayerMode === 'pins' && !selectedPin && (
                                        <div className="map-draw-desktop-empty">Choose a POI pin in the left panel to author its shape.</div>
                                    )}
                                    {drawLayerMode === 'traversable' && !selectedTraversableRegion && (
                                        <div className="map-draw-desktop-empty">Choose a traversable region in the left panel to redraw it.</div>
                                    )}
                                </div>

                                <div className="map-draw-desktop-card">
                                    <div className="map-draw-desktop-label">Calibration</div>
                                    <div className="map-draw-desktop-title">
                                        {geoCalibration ? `${geoCalibration.points.length} points saved` : 'No calibration saved'}
                                    </div>
                                    <div className="map-draw-desktop-note">
                                        Use Calibrate to align the tiled map with real-world GPS coordinates before exporting mobile results.
                                    </div>
                                </div>
                            </aside>
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

                {mapTileBundleError && (
                    <div
                        style={{
                            position: 'absolute',
                            left: 16,
                            right: 16,
                            top: pinsError ? 72 : 16,
                            background: 'rgba(245, 245, 245, 0.95)',
                            color: 'var(--neutral-700)',
                            padding: '10px 12px',
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 12,
                            zIndex: 1100
                        }}
                    >
                        {t('common.error')}: {mapTileBundleError}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuideMapDraw;
