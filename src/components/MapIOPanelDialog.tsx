import React from 'react';
import type { CloudBundleItem } from '../utils/cloudinaryCapture';
import './MapIOPanelDialog.css';

interface MapIOPanelDialogProps {
    open: boolean;
    onClose: () => void;
    status?: string;
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
    borderRadius: 10,
    border: 'none',
    padding: '0 12px',
    background: 'rgba(245, 245, 245, 0.95)',
    color: 'var(--neutral-800)',
    fontWeight: 900
};

const MapIOPanelDialog: React.FC<MapIOPanelDialogProps> = ({
    open,
    onClose,
    status,
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
                        <div className="map-io-section-title">{t('map.ioImportSection')}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                                value={selectedBundlePublicId}
                                onChange={(e) => onSelectBundle(e.target.value)}
                                disabled={bundles.length === 0 || listingBundles}
                                aria-label={t('map.cloudImportLabel')}
                                style={{
                                    ...fieldBaseStyle,
                                    flex: 1,
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
                                    width: 64,
                                    cursor: listingBundles ? 'not-allowed' : 'pointer',
                                    opacity: listingBundles ? 0.6 : 1
                                }}
                            >
                                {t('map.cloudRefreshShort')}
                            </button>

                            <button
                                onClick={onImport}
                                disabled={!canImport}
                                aria-label={t('map.cloudImport')}
                                title={t('map.cloudImport')}
                                style={{
                                    ...actionButtonStyle,
                                    width: 64,
                                    cursor: canImport ? 'pointer' : 'not-allowed',
                                    opacity: canImport ? 1 : 0.6
                                }}
                            >
                                {importingCloud ? t('map.cloudImportingShort') : t('map.cloudImportShort')}
                            </button>
                        </div>
                    </section>

                    <section className="map-io-section">
                        <div className="map-io-section-title">{t('map.ioExportSection')}</div>
                        <input
                            value={saveName}
                            onChange={(e) => onSaveNameChange(e.target.value)}
                            placeholder={t('map.cloudSaveNamePlaceholder')}
                            aria-label={t('map.cloudSaveName')}
                            style={{ ...fieldBaseStyle, width: '100%' }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={onExport}
                                disabled={!canExport}
                                aria-label={t('map.cloudExport')}
                                title={t('map.cloudExport')}
                                style={{
                                    ...actionButtonStyle,
                                    minWidth: 92,
                                    cursor: canExport ? 'pointer' : 'not-allowed',
                                    opacity: canExport ? 1 : 0.6
                                }}
                            >
                                {exportingCloud ? t('map.cloudExportingShort') : t('map.cloudExportShort')}
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