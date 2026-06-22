import React from 'react';

interface MapAssetLoadingBarProps {
    label?: string;
    fullHeight?: boolean;
}

const MapAssetLoadingBar: React.FC<MapAssetLoadingBarProps> = ({
    label = 'Fetching map assets...',
    fullHeight = true
}) => {
    return (
        <div
            style={{
                position: 'relative',
                minHeight: fullHeight ? '100%' : undefined,
                height: fullHeight ? '100%' : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(245,245,245,0.94) 0%, rgba(255,255,255,0.98) 100%)'
            }}
        >
            <style>{`
                @keyframes map-asset-loading-bar {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(260%); }
                }
            `}</style>
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    overflow: 'hidden',
                    background: 'rgba(33, 36, 39, 0.08)'
                }}
            >
                <div
                    style={{
                        width: '32%',
                        height: '100%',
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #f97316 0%, #ef4444 58%, #2563eb 100%)',
                        animation: 'map-asset-loading-bar 1.15s ease-in-out infinite'
                    }}
                />
            </div>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '32px 24px',
                    color: 'var(--neutral-700)',
                    textAlign: 'center'
                }}
            >
                <div
                    style={{
                        fontSize: 15,
                        fontWeight: 900,
                        letterSpacing: '0.01em'
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--neutral-500)'
                    }}
                >
                    Preparing the guide map for viewing.
                </div>
            </div>
        </div>
    );
};

export default MapAssetLoadingBar;
