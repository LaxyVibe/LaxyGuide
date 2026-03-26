import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { CloudBundleItem } from '../utils/cloudinaryCapture';
import './MapIOPanelDialog.css';

interface MapIOPanelDialogProps {
    open: boolean;
    onClose: () => void;
    status?: string;
    canClearAll: boolean;
    onClearAll: () => void;
    onChooseMapImage: () => void;
    saveName: string;
    onSaveNameChange: (value: string) => void;
    canExport: boolean;
    exportingCloud: boolean;
    onExport: () => void;
    bundles: CloudBundleItem[];
    selectedBundlePublicId: string;
    onSelectBundle: (publicId: string) => void;
    listingBundles: boolean;
    importingCloud: boolean;
    canImport: boolean;
    onRefreshBundles: () => void;
    onImport: () => void;
    t: (key: string) => string;
}

const fieldBaseStyle: React.CSSProperties = {
    height: 40,
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.08)',
    padding: '0 12px',
    background: 'rgba(245, 245, 245, 0.95)',
    color: 'var(--neutral-800)',
    fontWeight: 900
};

const actionButtonStyle: React.CSSProperties = {
    height: 40,
    width: 40,
    borderRadius: 10,
    border: 'none',
    padding: 0,
    background: 'rgba(245, 245, 245, 0.95)',
    color: 'var(--neutral-800)',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const MapIOPanelDialog: React.FC<MapIOPanelDialogProps> = ({
    open,
    onClose,
    status,
    canClearAll,
    onClearAll,
    onChooseMapImage,
    saveName,
    onSaveNameChange,
    canExport,
    exportingCloud,
    onExport,
    bundles,
    selectedBundlePublicId,
    onSelectBundle,
    listingBundles,
    importingCloud,
    canImport,
    onRefreshBundles,
    onImport,
    t
}) => {
    if (!open) return null;

    return (
        <div className="map-io-dialog-backdrop" onClick={onClose}>
            <div className="map-io-dialog" role="dialog" aria-modal="true" aria-label={t('map.ioDialogTitle')} onClick={(e) => e.stopPropagation()}>
                <div className="map-io-dialog-header">
                    <span className="map-io-dialog-title">{t('map.ioDialogTitle')}</span>
                    <button className="map-io-dialog-close" onClick={onClose} aria-label={t('map.ioClose')}>
                        ×
                    </button>
                </div>

                <div className="map-io-dialog-content">
                    <section className="map-io-section">
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={onClearAll}
                                disabled={!canClearAll}
                                aria-label={t('map.clearAllOnLocal')}
                                title={t('map.clearAllOnLocal')}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 12px',
                                    background: 'var(--status-red-alpha)',
                                    color: 'white',
                                    fontWeight: 900,
                                    cursor: canClearAll ? 'pointer' : 'not-allowed',
                                    opacity: canClearAll ? 1 : 0.6,
                                    flex: 1
                                }}
                            >
                                {t('map.clearAllOnLocal')}
                            </button>

                            <button
                                onClick={onChooseMapImage}
                                aria-label={t('map.replaceImageMap')}
                                title={t('map.replaceImageMap')}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 12px',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    flex: 1
                                }}
                            >
                                {t('map.replaceImageMap')}
                            </button>
                        </div>
                    </section>

                    <section className="map-io-section">
                        <div className="map-io-section-title">{t('map.ioImportSection')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <select
                                    value={selectedBundlePublicId}
                                    onChange={(e) => onSelectBundle(e.target.value)}
                                    disabled={bundles.length === 0 || listingBundles}
                                    aria-label={t('map.cloudImportLabel')}
                                    style={{
                                        ...fieldBaseStyle,
                                        flex: 1,
                                        minWidth: 220,
                                        cursor: bundles.length === 0 || listingBundles ? 'not-allowed' : 'pointer',
                                        opacity: bundles.length === 0 || listingBundles ? 0.6 : 1
                                    }}
                                >
                                    {bundles.length === 0 ? (
                                        <option value="">{t('map.cloudNoBundles')}</option>
                                    ) : (
                                        bundles.map((bundle) => (
                                            <option key={bundle.publicId} value={bundle.publicId}>
                                                {`${bundle.saveName} / ${bundle.createdAt}`}
                                            </option>
                                        ))
                                    )}
                                </select>

                                <button
                                    onClick={onRefreshBundles}
                                    disabled={listingBundles}
                                    aria-label={t('map.cloudRefresh')}
                                    title={t('map.cloudRefresh')}
                                    style={{
                                        ...actionButtonStyle,
                                        cursor: listingBundles ? 'not-allowed' : 'pointer',
                                        opacity: listingBundles ? 0.6 : 1
                                    }}
                                >
                                    <RefreshCw size={18} strokeWidth={2.4} />
                                </button>
                            </div>

                            <button
                                onClick={onImport}
                                disabled={!canImport}
                                aria-label={t('map.cloudImport')}
                                title={t('map.cloudImport')}
                                style={{
                                    width: '100%',
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 12px',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: canImport ? 'pointer' : 'not-allowed',
                                    opacity: canImport ? 1 : 0.6
                                }}
                            >
                                {importingCloud ? t('map.cloudImportingShort') : t('map.cloudImport')}
                            </button>
                        </div>
                    </section>

                    <section className="map-io-section">
                        <div className="map-io-section-title">{t('map.ioExportSection')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                                value={saveName}
                                onChange={(e) => onSaveNameChange(e.target.value)}
                                placeholder={t('map.cloudSaveNamePlaceholder')}
                                aria-label={t('map.cloudSaveName')}
                                style={{ ...fieldBaseStyle, width: '100%' }}
                            />
                            <button
                                onClick={onExport}
                                disabled={!canExport}
                                aria-label={t('map.cloudExport')}
                                title={t('map.cloudExport')}
                                style={{
                                    width: '100%',
                                    height: 40,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: '0 12px',
                                    background: 'rgba(245, 245, 245, 0.95)',
                                    color: 'var(--neutral-800)',
                                    fontWeight: 900,
                                    cursor: canExport ? 'pointer' : 'not-allowed',
                                    opacity: canExport ? 1 : 0.6
                                }}
                            >
                                {exportingCloud ? t('map.cloudExportingShort') : t('map.cloudExport')}
                            </button>
                        </div>
                    </section>

                    {status ? <div className="map-io-status">{status}</div> : null}
                </div>
            </div>
        </div>
    );
};

export default MapIOPanelDialog;