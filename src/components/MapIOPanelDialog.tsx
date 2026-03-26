import React from 'react';
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
    const [activeTab, setActiveTab] = React.useState<'local' | 'load' | 'save'>('local');

    React.useEffect(() => {
        if (open) {
            setActiveTab('local');
        }
    }, [open]);

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
                    <div className="map-io-tabs" role="tablist" aria-label={t('map.ioDialogTitle')}>
                        <button
                            className={`map-io-tab ${activeTab === 'local' ? 'is-active' : ''}`}
                            role="tab"
                            aria-selected={activeTab === 'local'}
                            onClick={() => setActiveTab('local')}
                        >
                            Local
                        </button>
                        <button
                            className={`map-io-tab ${activeTab === 'load' ? 'is-active' : ''}`}
                            role="tab"
                            aria-selected={activeTab === 'load'}
                            onClick={() => setActiveTab('load')}
                        >
                            {t('map.ioImportSection')}
                        </button>
                        <button
                            className={`map-io-tab ${activeTab === 'save' ? 'is-active' : ''}`}
                            role="tab"
                            aria-selected={activeTab === 'save'}
                            onClick={() => setActiveTab('save')}
                        >
                            {t('map.ioExportSection')}
                        </button>
                    </div>

                    {activeTab === 'local' && (
                        <section className="map-io-section" role="tabpanel">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <button
                                    className="map-io-block-button is-danger"
                                    onClick={onClearAll}
                                    disabled={!canClearAll}
                                    aria-label={t('map.clearAllOnLocal')}
                                    title={t('map.clearAllOnLocal')}
                                >
                                    Clear All
                                </button>

                                <button
                                    className="map-io-block-button"
                                    onClick={onChooseMapImage}
                                    aria-label={t('map.replaceImageMap')}
                                    title={t('map.replaceImageMap')}
                                >
                                    Replace Base Image
                                </button>
                            </div>
                        </section>
                    )}

                    {activeTab === 'load' && (
                        <section role="tabpanel">
                            <div className="map-io-section-title">{t('map.ioImportSection')}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                                <select
                                    value={selectedBundlePublicId}
                                    onChange={(e) => onSelectBundle(e.target.value)}
                                    disabled={bundles.length === 0 || listingBundles}
                                    aria-label={t('map.cloudImportLabel')}
                                    style={{
                                        ...fieldBaseStyle,
                                        width: '100%',
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
                                    className="map-io-block-button"
                                    onClick={onImport}
                                    disabled={!canImport}
                                    aria-label={t('map.cloudImport')}
                                    title={t('map.cloudImport')}
                                >
                                    {importingCloud ? `${t('common.loading')}...` : 'Load'}
                                </button>

                                <button
                                    className="map-io-text-link"
                                    onClick={onRefreshBundles}
                                    disabled={listingBundles}
                                    aria-label={t('map.cloudRefresh')}
                                    title={t('map.cloudRefresh')}
                                >
                                    {listingBundles ? `${t('common.loading')}...` : t('map.cloudRefresh')}
                                </button>
                            </div>
                        </section>
                    )}

                    {activeTab === 'save' && (
                        <section role="tabpanel">
                            <div className="map-io-section-title">{t('map.ioExportSection')}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                                <input
                                    value={saveName}
                                    onChange={(e) => onSaveNameChange(e.target.value)}
                                    placeholder={t('map.cloudSaveNamePlaceholder')}
                                    aria-label={t('map.cloudSaveName')}
                                    style={{ ...fieldBaseStyle, width: '100%' }}
                                />
                                <button
                                    className="map-io-block-button"
                                    onClick={onExport}
                                    disabled={!canExport}
                                    aria-label={t('map.cloudExport')}
                                    title={t('map.cloudExport')}
                                >
                                    {exportingCloud ? `${t('common.loading')}...` : 'Save'}
                                </button>
                            </div>
                        </section>
                    )}

                    {status ? <div className="map-io-status">{status}</div> : null}
                </div>
            </div>
        </div>
    );
};

export default MapIOPanelDialog;