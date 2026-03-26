import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import MapViewer, { type MapViewerHandle } from '../components/MapViewer';
import MapIOPanelDialog from '../components/MapIOPanelDialog';
import PinPolygonEditor from '../components/PinPolygonEditor';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';
import type { MapPin, MapPinsFile } from '../types';
import { getPinsStorageKey, loadPinsFromLocalStorage, savePinsToLocalStorage, upsertPin } from '../utils/mapPins';
import { convexHullLatLng } from '../utils/convexHull';
import { getNextLetterId } from '../utils/pinIdUtils';
import { downloadCloudBundle, listCloudBundles, requestCloudinarySignedUpload, type CloudBundleItem, uploadCloudBundle } from '../utils/cloudinaryCapture';
import { buildCaptureBundle, imageSourceToBlob, parseCaptureBundle } from '../utils/mapCaptureBundle';

const FILE_VERSION = 2;

const GuideMapCapture: React.FC = () => {
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

    const [activeId, setActiveId] = useState('');
    const [pinsFile, setPinsFile] = useState<MapPinsFile | null>(null);
    const [status, setStatus] = useState<string>('');
    const [fabOpen, setFabOpen] = useState(false);
    const [ioDialogOpen, setIoDialogOpen] = useState(false);
    const [didAutoCenter, setDidAutoCenter] = useState(false);
    const [captureView, setCaptureView] = useState<'image' | 'polygon'>('image');
    const [mapImageOverride, setMapImageOverride] = useState<string | null>(null);
    const [saveName, setSaveName] = useState('');
    const [bundles, setBundles] = useState<CloudBundleItem[]>([]);
    const [selectedBundlePublicId, setSelectedBundlePublicId] = useState('');
    const [listingBundles, setListingBundles] = useState(false);
    const [exportingCloud, setExportingCloud] = useState(false);
    const [importingCloud, setImportingCloud] = useState(false);
    const gpsPermissionPromptedRef = React.useRef(false);

    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const mapRef = React.useRef<MapViewerHandle | null>(null);

    useEffect(() => {
        if (!guideId) return;

        // Load any locally chosen map image override (capture-only).
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

        const local = loadPinsFromLocalStorage(guideId);
        if (local) {
            setPinsFile(local);
            if (local.pins.length > 0) {
                setActiveId((prev) => prev || local.pins[local.pins.length - 1].id);
            }
        } else {
            setPinsFile({ version: FILE_VERSION, guideId, pins: [] });
        }
        setDidAutoCenter(false);
        setSaveName('');
        setBundles([]);
        setSelectedBundlePublicId('');
    }, [guideId]);

    const pins = pinsFile?.pins ?? [];
    const selectedPin = useMemo(() => pins.find(p => p.id === activeId), [pins, activeId]);
    const selectedLatLngs = selectedPin?.latLngs || [];
    const mapImage = mapImageOverride || data?.mapImage;

    const canExport = Boolean(guideId) && Boolean(pinsFile) && Boolean(mapImage) && Boolean(saveName.trim()) && !exportingCloud;
    const canImport = Boolean(guideId) && Boolean(selectedBundlePublicId) && !importingCloud;

    const handleListBundles = async () => {
        if (!guideId) return;
        setListingBundles(true);
        try {
            const next = await listCloudBundles(guideId);
            setBundles(next);
            setSelectedBundlePublicId((prev) => {
                if (prev && next.some((item) => item.publicId === prev)) return prev;
                return next[0]?.publicId || '';
            });
        } catch {
            // Keep menu clean: listing failures should not surface as a persistent status line.
            setStatus((prev) => (prev === t('map.cloudListFailed') ? '' : prev));
        } finally {
            setListingBundles(false);
        }
    };

    useEffect(() => {
        if (!ioDialogOpen || !guideId) return;
        void handleListBundles();
    }, [ioDialogOpen, guideId]);

    useEffect(() => {
        if (fabOpen) return;
        setIoDialogOpen(false);
    }, [fabOpen]);

    const handleSwapToView = () => {
        const to = guideId ? `/${guideId}/map?${searchParams.toString()}` : `/?${searchParams.toString()}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => navigate(to));
        } else {
            navigate(to);
        }
    };

    const highlightedPinId = useMemo(() => {
        if (!activeId) return undefined;
        return pins.some(p => p.id === activeId) ? activeId : undefined;
    }, [activeId, pins]);

    const getNextPinId = () => {
        return getNextLetterId(pins.map(p => p.id));
    };

    const handleAddPin = () => {
        if (!guideId) return;
        const id = getNextPinId();
        const center = mapRef.current?.getViewportCenter() ?? { x: 0.5, y: 0.5 };
        const pin: MapPin = {
            id,
            label: id,
            x: center.x,
            y: center.y,
            latLngs: [],
            createdAt: new Date().toISOString()
        };

        setPinsFile((prev) => {
            const next: MapPinsFile = prev
                ? { ...prev, version: FILE_VERSION, guideId, pins: [...prev.pins, pin] }
                : { version: FILE_VERSION, guideId, pins: [pin] };
            savePinsToLocalStorage(guideId, next);
            return next;
        });
        setActiveId(id);
        setStatus('');
    };

    const playAssignSound = () => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.value = 0.0001;
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;
            gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.13);

            osc.onended = () => {
                ctx.close().catch(() => undefined);
            };
        } catch {
            // ignore
        }
    };

    const vibrateOnAssignSuccess = () => {
        try {
            if (typeof navigator.vibrate === 'function') {
                navigator.vibrate(120);
            }
        } catch {
            // ignore
        }
    };

    const requestGpsPermissionOnFirstMenuClick = () => {
        if (gpsPermissionPromptedRef.current) return;
        gpsPermissionPromptedRef.current = true;

        const promptedKey = 'mapCapture:gpsPermissionPrompted';
        try {
            if (localStorage.getItem(promptedKey) === '1') return;
        } catch {
            // ignore storage errors and still attempt prompt once for this page load
        }

        if (!('geolocation' in navigator)) return;

        const persistPrompted = () => {
            try {
                localStorage.setItem(promptedKey, '1');
            } catch {
                // ignore storage errors
            }
        };

        navigator.geolocation.getCurrentPosition(
            () => {
                persistPrompted();
            },
            (err) => {
                // iOS Safari can return transient errors before a stable fix.
                // Only persist when the user actually denied permission.
                if (err && err.code === 1) {
                    persistPrompted();
                    return;
                }

                // Allow retry on subsequent menu clicks for transient failures.
                gpsPermissionPromptedRef.current = false;
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }
        );
    };

    const handleSelectPin = (nextId: string) => {
        setActiveId(nextId);
        setStatus('');

        const p = pins.find(pin => pin.id === nextId);
        if (p) {
            mapRef.current?.centerOnPoint({ x: p.x, y: p.y });
        }
    };

    const handleUpdateSelectedLabel = (nextLabel: string) => {
        if (!guideId) return;
        if (!activeId) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const current = prev.pins.find(p => p.id === activeId);
            if (!current) return prev;

            const updated: MapPin = { ...current, label: nextLabel };
            const next: MapPinsFile = {
                ...prev,
                version: FILE_VERSION,
                guideId,
                pins: upsertPin(prev.pins, updated)
            };
            savePinsToLocalStorage(guideId, next);
            return next;
        });
    };

    const handleRenameActivePin = () => {
        if (!activeId) return;
        const currentLabel = selectedPin?.label ?? activeId;
        const next = window.prompt(t('map.pinLabel'), currentLabel);
        if (next === null) return;
        handleUpdateSelectedLabel(next.trim() || activeId);
    };

    const handleUpdateSelectedPolygon = (nextPolygon: MapPin['polygon']) => {
        if (!guideId) return;
        if (!activeId) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const current = prev.pins.find(p => p.id === activeId);
            if (!current) return prev;

            const updated: MapPin = { ...current, polygon: nextPolygon };
            const next: MapPinsFile = {
                ...prev,
                version: FILE_VERSION,
                guideId,
                pins: upsertPin(prev.pins, updated)
            };
            savePinsToLocalStorage(guideId, next);
            return next;
        });
    };

    useEffect(() => {
        if (didAutoCenter) return;
        if (!activeId) return;
        if (captureView !== 'image') return;
        const p = pins.find(pin => pin.id === activeId);
        if (!p) return;
        mapRef.current?.centerOnPoint({ x: p.x, y: p.y });
        setDidAutoCenter(true);
    }, [didAutoCenter, activeId, pins, captureView]);

    useEffect(() => {
        if (captureView !== 'polygon') return;
        if (!guideId) return;
        if (!activeId) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const current = prev.pins.find(p => p.id === activeId);
            if (!current) return prev;

            const gps = (current.latLngs || []).map(p => ({ lat: p.lat, lng: p.lng }));
            const hasEnough = gps.length >= 3;
            const hasPolygon = Array.isArray(current.polygon) && current.polygon.length >= 3;
            if (!hasEnough || hasPolygon) return prev;

            const hull = convexHullLatLng(gps);
            if (hull.length < 3) return prev;

            const updated: MapPin = { ...current, polygon: hull };
            const next: MapPinsFile = {
                ...prev,
                version: FILE_VERSION,
                guideId,
                pins: upsertPin(prev.pins, updated)
            };
            savePinsToLocalStorage(guideId, next);
            return next;
        });
    }, [captureView, guideId, activeId]);

    const handleAssignGps = (targetPinId?: string) => {
        if (!guideId) return;
        const pinId = targetPinId || activeId;
        if (!pinId) {
            setStatus(t('map.noActivePin'));
            return;
        }

        if (pinId !== activeId) {
            setActiveId(pinId);
        }

        setStatus(t('map.capturing'));
        if (!('geolocation' in navigator)) {
            setStatus(t('map.captureFailed'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setPinsFile((prev) => {
                    if (!prev) return prev;
                    const current = prev.pins.find(p => p.id === pinId);
                    if (!current) return prev;

                    const maxSeq = Math.max(
                        0,
                        ...(current.latLngs || []).map(p => (typeof p.seq === 'number' && Number.isFinite(p.seq) ? p.seq : 0))
                    );

                    const point = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        capturedAt: new Date().toISOString(),
                        seq: Math.floor(maxSeq) + 1
                    };

                    const updated: MapPin = {
                        ...current,
                        latLngs: [...(current.latLngs || []), point]
                    };

                    const next: MapPinsFile = {
                        ...prev,
                        version: FILE_VERSION,
                        guideId,
                        pins: upsertPin(prev.pins, updated)
                    };
                    savePinsToLocalStorage(guideId, next);
                    return next;
                });

                setStatus(t('map.assignedGps'));
                playAssignSound();
                vibrateOnAssignSuccess();
            },
            () => {
                setStatus(t('map.locationDenied'));
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handleRemoveGpsPoint = (index: number) => {
        if (!guideId) return;
        if (!activeId) {
            setStatus(t('map.noActivePin'));
            return;
        }

        const ok = window.confirm(t('map.removeGpsConfirm'));
        if (!ok) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const current = prev.pins.find(p => p.id === activeId);
            if (!current) return prev;

            const nextLatLngs = (current.latLngs || []).filter((_, i) => i !== index);
            const updated: MapPin = { ...current, latLngs: nextLatLngs };
            const next: MapPinsFile = {
                ...prev,
                version: FILE_VERSION,
                guideId,
                pins: upsertPin(prev.pins, updated)
            };
            savePinsToLocalStorage(guideId, next);
            return next;
        });

        setStatus('');
    };

    const handleRemovePin = () => {
        if (!guideId) return;
        if (!activeId) {
            setStatus(t('map.noActivePin'));
            return;
        }

        const ok = window.confirm(t('map.removePinConfirm'));
        if (!ok) return;

        setPinsFile((prev) => {
            if (!prev) return prev;
            const nextPins = prev.pins.filter(p => p.id !== activeId);
            const next: MapPinsFile = { ...prev, version: FILE_VERSION, guideId, pins: nextPins };
            savePinsToLocalStorage(guideId, next);
            return next;
        });

        setActiveId((prev) => {
            const remaining = pins.filter(p => p.id !== prev);
            return remaining.length > 0 ? remaining[remaining.length - 1].id : '';
        });
        setStatus('');
    };

    const handleExport = async () => {
        if (!guideId || !pinsFile || !mapImage) return;

        const trimmedSaveName = saveName.trim();
        if (!trimmedSaveName) {
            setStatus(t('map.cloudSaveNameRequired'));
            return;
        }

        setExportingCloud(true);
        setStatus(t('map.cloudExporting'));

        try {
            const imageBlob = await imageSourceToBlob(mapImage);
            const bundleBlob = await buildCaptureBundle({
                guideId,
                saveName: trimmedSaveName,
                pinsFile,
                imageBlob
            });

            const signed = await requestCloudinarySignedUpload(guideId, trimmedSaveName);
            await uploadCloudBundle(bundleBlob, signed);
            await handleListBundles();
            setStatus(t('map.cloudExported'));
        } catch {
            setStatus(t('map.cloudExportFailed'));
        } finally {
            setExportingCloud(false);
        }
    };

    const handleImport = async () => {
        if (!guideId || !selectedBundlePublicId) return;

        const selectedBundle = bundles.find((b) => b.publicId === selectedBundlePublicId);
        if (!selectedBundle) {
            setStatus(t('map.cloudNoBundleSelected'));
            return;
        }

        const ok = window.confirm(t('map.cloudImportConfirm'));
        if (!ok) return;

        setImportingCloud(true);
        setStatus(t('map.cloudImporting'));

        try {
            const bundleBlob = await downloadCloudBundle(selectedBundle.secureUrl, {
                publicId: selectedBundle.publicId,
                format: selectedBundle.format
            });
            const parsed = await parseCaptureBundle(bundleBlob, guideId);

            setPinsFile(parsed.pinsFile);
            setActiveId(parsed.pinsFile.pins[parsed.pinsFile.pins.length - 1]?.id || '');
            savePinsToLocalStorage(guideId, parsed.pinsFile);

            setMapImageOverride(parsed.imageDataUrl);
            try {
                localStorage.setItem(`mapImageOverride:${guideId}`, parsed.imageDataUrl);
            } catch {
                // Keep in-memory image even if localStorage quota is exceeded.
            }

            setCaptureView('image');
            setDidAutoCenter(false);
            setStatus(t('map.cloudImported'));
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            console.error('[map-capture] cloud import failed', {
                guideId,
                selectedBundle,
                message,
                err
            });
            setStatus(message ? `${t('map.cloudImportFailed')}: ${message}` : t('map.cloudImportFailed'));
        } finally {
            setImportingCloud(false);
        }
    };

    const handleClearAll = () => {
        if (!guideId) return;
        const ok = window.confirm(t('map.clearAllConfirm'));
        if (!ok) return;

        try {
            localStorage.removeItem(getPinsStorageKey(guideId));
        } catch {
            // ignore
        }

        setPinsFile({ version: FILE_VERSION, guideId, pins: [] });
        setActiveId('');
        setDidAutoCenter(false);
        setStatus(t('map.clearedAll'));
        setFabOpen(false);
    };

    if (transLoading || guideLoading) return <Loading />;
    if (error) return <div>{t('common.error')}: {error}</div>;

    const handleChooseMapImage = () => {
        setIoDialogOpen(false);
        fileInputRef.current?.click();
    };

    const handleMapImageFile = async (file: File | null) => {
        if (!guideId || !file) return;
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('read_failed'));
                reader.onload = () => resolve(String(reader.result || ''));
                reader.readAsDataURL(file);
            });

            if (!dataUrl.startsWith('data:image/')) throw new Error('not_image');

            setMapImageOverride(dataUrl);
            try {
                localStorage.setItem(`mapImageOverride:${guideId}`, dataUrl);
            } catch {
                // If storage is full (large image), still keep it in-memory for this session.
            }
            setStatus(t('map.mapImageReplaced'));
            setCaptureView('image');
            setDidAutoCenter(false);
            setFabOpen(false);
        } catch {
            setStatus(t('map.mapImageReplaceFailed'));
        }
    };

    return (
        <div className="page">
            <GlobalHeader
                title={t('map.captureTitle')}
                showBack={false}
                leftSlot={
                    <button
                        className="back-button"
                        onClick={handleSwapToView}
                        aria-label={t('map.swapToView')}
                        title={t('map.swapToView')}
                    >
                        <span aria-hidden="true" style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>
                            ⇄
                        </span>
                    </button>
                }
                rightSlot={
                    <button
                        className="back-button"
                        onClick={() => {
                            requestGpsPermissionOnFirstMenuClick();
                            setFabOpen(o => !o);
                        }}
                        aria-label={t('map.tools')}
                        aria-pressed={fabOpen}
                    >
                        <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>
                            ☰
                        </span>
                    </button>
                }
            />

            <div
                className="scroll-content"
                style={{
                    position: 'relative',
                    overflowY: captureView === 'polygon' ? 'hidden' : undefined,
                    touchAction: captureView === 'polygon' ? 'none' : undefined
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        // Allow re-selecting the same file.
                        e.currentTarget.value = '';
                        void handleMapImageFile(f);
                    }}
                />

                {captureView === 'polygon' ? (
                    activeId && selectedPin ? (
                        <PinPolygonEditor pin={selectedPin} onPolygonChange={handleUpdateSelectedPolygon} />
                    ) : (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                            {t('map.noActivePin')}
                        </div>
                    )
                ) : !mapImage ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--neutral-600)', fontWeight: 700 }}>
                        {t('map.noImage')}
                    </div>
                ) : (
                    <MapViewer
                        ref={mapRef}
                        imageUrl={mapImage}
                        pins={pins}
                        highlightedPinId={highlightedPinId}
                        showCenterCursor={true}
                        onPinClick={handleSelectPin}
                        onPinLongPress={(pinId) => handleAssignGps(pinId)}
                        pinLongPressMs={1200}
                        initialScale={6}
                    />
                )}

                {fabOpen && (
                    <div
                        style={{
                            position: 'fixed',
                            right: 16,
                            top: 'calc(env(safe-area-inset-top) + 72px)',
                            zIndex: 3000,
                            width: 'min(340px, calc(100% - 32px))',
                            background: 'rgba(245, 245, 245, 0.95)',
                            border: '1px solid var(--neutral-200)',
                            borderRadius: 16,
                            padding: 12,
                            color: 'var(--neutral-800)'
                        }}
                    >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                            <button
                                onClick={() => {
                                    setCaptureView('image');
                                    setDidAutoCenter(false);
                                }}
                                aria-pressed={captureView === 'image'}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: '1px solid var(--neutral-300)',
                                    padding: '0 12px',
                                    background: captureView === 'image' ? 'var(--misc-opam)' : 'rgba(33, 36, 39, 0.1)',
                                    color: captureView === 'image' ? 'white' : 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                {t('map.viewImage')}
                            </button>

                            <button
                                onClick={() => setCaptureView('polygon')}
                                aria-pressed={captureView === 'polygon'}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: '1px solid var(--neutral-300)',
                                    padding: '0 12px',
                                    background: captureView === 'polygon' ? 'var(--misc-opam)' : 'rgba(33, 36, 39, 0.1)',
                                    color: captureView === 'polygon' ? 'white' : 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                {t('map.viewPolygon')}
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                            <select
                                value={activeId}
                                onChange={(e) => handleSelectPin(e.target.value)}
                                disabled={pins.length === 0}
                                aria-label={t('map.selectPin')}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    padding: '0 12px',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: pins.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: pins.length === 0 ? 0.6 : 1,
                                    flex: 1
                                }}
                            >
                                <option value="" disabled>
                                    {t('map.selectPin')}
                                </option>
                                {pins.map((p) => {
                                    return (
                                        <option key={p.id} value={p.id}>
                                            {(p.label || p.id)}
                                        </option>
                                    );
                                })}
                            </select>

                            <button
                                onClick={handleAddPin}
                                aria-label={t('map.addPin')}
                                title={t('map.addPin')}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    border: '1px solid var(--neutral-300)',
                                    padding: 0,
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    fontSize: 18,
                                    cursor: 'pointer'
                                }}
                            >
                                +
                            </button>

                            <button
                                onClick={handleRemovePin}
                                disabled={!activeId}
                                aria-label={t('map.removePin')}
                                title={t('map.removePin')}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    border: '1px solid var(--neutral-300)',
                                    padding: 0,
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    fontSize: 18,
                                    cursor: activeId ? 'pointer' : 'not-allowed',
                                    opacity: activeId ? 1 : 0.6
                                }}
                            >
                                −
                            </button>

                            <button
                                onClick={handleRenameActivePin}
                                disabled={!activeId}
                                aria-label={t('map.pinLabel')}
                                title={t('map.pinLabel')}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    border: '1px solid var(--neutral-300)',
                                    padding: 0,
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    fontSize: 18,
                                    cursor: activeId ? 'pointer' : 'not-allowed',
                                    opacity: activeId ? 1 : 0.6
                                }}
                            >
                                ✎
                            </button>
                        </div>

                        {activeId && (
                            <div style={{ marginTop: 0 }}>

                                {captureView === 'polygon' && selectedLatLngs.length > 0 && selectedLatLngs.length < 3 && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', marginBottom: 8 }}>
                                        {t('map.polygonNeed3Points')}
                                    </div>
                                )}

                                {selectedLatLngs.length === 0 ? (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)' }}>{t('map.noGpsPoints')}</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflow: 'auto' }}>
                                        {selectedLatLngs.map((p, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 10,
                                                    background: 'rgba(245, 245, 245, 0.95)',
                                                    border: '1px solid rgba(0,0,0,0.06)',
                                                    borderRadius: 12,
                                                    padding: '10px 12px'
                                                }}
                                            >
                                                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--neutral-800)' }}>
                                                    {activeId}{p.seq ?? (idx + 1)} — {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveGpsPoint(idx)}
                                                    style={{
                                                        height: 32,
                                                        borderRadius: 10,
                                                        border: '1px solid var(--neutral-300)',
                                                        padding: '0 10px',
                                                        background: 'rgba(33, 36, 39, 0.1)',
                                                        color: 'var(--neutral-800)',
                                                        fontWeight: 900,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {t('map.removeGps')}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {status && (
                            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: 'var(--neutral-600)' }}>{status}</div>
                        )}

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 12 }}>
                            <button
                                onClick={() => setIoDialogOpen(true)}
                                aria-label={t('map.ioButton')}
                                title={t('map.ioButton')}
                                style={{
                                    width: '100%',
                                    height: 40,
                                    borderRadius: 10,
                                    border: '1px solid var(--neutral-300)',
                                    padding: 0,
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                {t('map.ioButton')}
                            </button>
                        </div>
                    </div>
                )}

                <MapIOPanelDialog
                    open={ioDialogOpen}
                    onClose={() => setIoDialogOpen(false)}
                    status={status}
                    canClearAll={Boolean(guideId) && pins.length > 0}
                    onClearAll={handleClearAll}
                    onChooseMapImage={handleChooseMapImage}
                    saveName={saveName}
                    onSaveNameChange={setSaveName}
                    canExport={canExport}
                    exportingCloud={exportingCloud}
                    onExport={() => void handleExport()}
                    bundles={bundles}
                    selectedBundlePublicId={selectedBundlePublicId}
                    onSelectBundle={setSelectedBundlePublicId}
                    listingBundles={listingBundles}
                    importingCloud={importingCloud}
                    canImport={canImport}
                    onRefreshBundles={() => void handleListBundles()}
                    onImport={() => void handleImport()}
                    t={t}
                />
            </div>
        </div>
    );
};

export default GuideMapCapture;
