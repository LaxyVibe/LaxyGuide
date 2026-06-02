import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import Loading from '../components/Loading';
import TiledMapDrawer from '../components/TiledMapDrawer';
import { useGuideData } from '../hooks/useGuideData';
import { useTranslation } from '../hooks/useTranslation';
import type { MapPin, MapPinsFile } from '../types';
import { downloadJson, fetchPinsFile, normalizePinsFile } from '../utils/mapPins';
import { getNextLetterId } from '../utils/pinIdUtils';
import { ensureLanguageParam, getLanguageFromQuery, setLanguageInQuery } from '../utils/languageUtils';

const getDrawStorageKey = (guideId: string) => `mapPins_draw_${guideId}`;

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

function mergePinsWithDrawOverrides(basePins: MapPin[], drawPins: MapPin[]): MapPin[] {
    const drawById = new Map(drawPins.map((pin) => [pin.id, pin]));
    const baseIds = new Set(basePins.map((pin) => pin.id));

    // Update polygons on existing base pins, then append draw-only pins
    // (created via the + button) so they survive page reloads.
    const merged = basePins.map((pin) => {
        const drawPin = drawById.get(pin.id);
        if (!drawPin) return pin;
        return { ...pin, polygon: drawPin.polygon };
    });

    const drawOnlyPins = drawPins.filter((pin) => !baseIds.has(pin.id));
    return [...merged, ...drawOnlyPins];
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

    const [pinsFile, setPinsFile] = useState<MapPinsFile | null>(null);
    const [pinsError, setPinsError] = useState<string | null>(null);
    const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
    const [movePinMode, setMovePinMode] = useState(false);
    const initialSelectRef = useRef(true);
    const [fabMenuOpen, setFabMenuOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setPinsError(null);
            if (!guideId) {
                setPinsFile(null);
                return;
            }

            const url = data?.mapPinsUrl;
            if (!url) {
                // No server file — restore any pins saved locally (e.g. via the + button).
                const localFile = loadDrawPinsFromLocalStorage(guideId);
                const localPins = localFile?.pins ?? [];
                setPinsFile({ version: 2, guideId, pins: localPins });
                setSelectedPinId((prev) => {
                    if (prev && localPins.some((pin) => pin.id === prev)) return prev;
                    return localPins[0]?.id ?? null;
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
                setSelectedPinId((prev) => {
                    if (prev && mergedPins.some((pin) => pin.id === prev)) return prev;
                    return mergedPins[0]?.id ?? null;
                });
            } catch (e) {
                if (cancelled) return;
                setPinsFile({ version: 2, guideId, pins: [] });
                setPinsError(e instanceof Error ? e.message : String(e));
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [guideId, data?.mapPinsUrl]);

    const pins = pinsFile?.pins ?? [];

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

    const pinDisplayNameById = useMemo(() => {
        const byNumber = new Map((data?.pois ?? []).map((poi) => [poi.number, poi.title]));
        const out: Record<string, string> = {};
        for (const pin of pins) {
            const poiNumber = (pin.label ?? pin.id).trim();
            out[pin.id] = byNumber.get(poiNumber) || pin.label || pin.id;
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
        const nextId = getNextLetterId(currentPins.map((pin) => pin.id));
        const nextPin: MapPin = {
            id: nextId,
            label: nextId,
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
        const payload: MapPinsFile = {
            version: 2,
            guideId,
            pins
        };
        downloadJson(`${guideId}-draw-pins.json`, payload);
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
                                    onClick={() => {
                                        setMovePinMode((prev) => !prev);
                                        setFabMenuOpen(false);
                                    }}
                                    disabled={!selectedPinId}
                                    aria-label="Move selected pin"
                                    title="Move"
                                    style={{
                                        height: 44,
                                        minWidth: 80,
                                        borderRadius: 12,
                                        border: 'none',
                                        background: movePinMode ? '#f59e0b' : 'rgba(33, 36, 39, 0.15)',
                                        color: movePinMode ? '#fff' : 'var(--neutral-800)',
                                        fontWeight: 900,
                                        fontSize: 13,
                                        padding: '0 14px',
                                        cursor: selectedPinId ? 'pointer' : 'not-allowed',
                                        opacity: selectedPinId ? 1 : 0.5,
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Move
                                </button>
                                <button
                                    onClick={() => {
                                        handleAddPin();
                                        setFabMenuOpen(false);
                                    }}
                                    aria-label="Add pin"
                                    title="Add pin"
                                    style={{
                                        height: 44,
                                        minWidth: 80,
                                        borderRadius: 12,
                                        border: 'none',
                                        background: 'rgba(33, 36, 39, 0.15)',
                                        color: 'var(--neutral-800)',
                                        fontWeight: 900,
                                        fontSize: 13,
                                        padding: '0 14px',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Add Pin
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
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <TiledMapDrawer
                                mapTileUrlTemplate={data!.mapTileUrlTemplate!}
                                mapTileMaxZoom={data!.mapTileMaxZoom}
                                mapPixelWidth={data!.mapPixelWidth!}
                                mapPixelHeight={data!.mapPixelHeight!}
                                pins={pins}
                                selectedPinId={selectedPinId}
                                pinDisplayNameById={pinDisplayNameById}
                                onPinSelect={setSelectedPinId}
                                onPolygonChange={handlePolygonChange}
                                onMapClick={(point) => {
                                    if (movePinMode) {
                                        handleMoveSelectedPin(point);
                                    }
                                }}
                            />
                        </div>

                        {movePinMode && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 16,
                                    right: 16,
                                    top: 16,
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
                                {selectedPinId && (
                                    <button
                                        onClick={() => setSelectedPinId(null)}
                                        aria-label="Clear selection"
                                        title="Clear selection"
                                        style={{
                                            flexShrink: 0,
                                            border: 'none',
                                            borderRadius: 999,
                                            width: 36,
                                            height: 36,
                                            background: 'rgba(33, 36, 39, 0.12)',
                                            color: 'var(--neutral-800)',
                                            fontWeight: 900,
                                            fontSize: 18,
                                            lineHeight: 1,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                                {pins.map((pin) => {
                                    const isSelected = pin.id === selectedPinId;
                                    const title = pinDisplayNameById[pin.id] || pin.label || pin.id;
                                    const hasPolygon = Array.isArray(pin.polygon) && pin.polygon.length >= 3;
                                    return (
                                        <button
                                            key={pin.id}
                                            onClick={() => setSelectedPinId(pin.id)}
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
                                            <span>{title}</span>
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
