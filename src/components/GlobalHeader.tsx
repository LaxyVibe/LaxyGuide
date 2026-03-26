import React from 'react';
import { useNavigate } from 'react-router-dom';
import backIcon from '../assets/icons/back.svg';
import { APP_VERSION } from '../constants/appVersion';

interface GlobalHeaderProps {
    title?: string;
    showBack?: boolean;
    onBack?: () => void;
    leftSlot?: React.ReactNode;
    rightSlot?: React.ReactNode;
    versionOverride?: string;
    style?: React.CSSProperties;
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({ title, showBack = true, onBack, leftSlot, rightSlot, versionOverride, style }) => {
    const navigate = useNavigate();

    return (
        <header className="global-header" style={style}>
            {leftSlot ? (
                leftSlot
            ) : showBack ? (
                <button className="back-button" onClick={onBack ? onBack : () => {
                    if ('startViewTransition' in document) {
                        document.startViewTransition(() => {
                            navigate(-1);
                        });
                    } else {
                        navigate(-1);
                    }
                }}>
                    <img src={backIcon} alt="Back" style={{ width: 28, height: 28 }} />
                </button>
            ) : null}
            <h1>{title}</h1>
            <div className="global-header-right">
                <span className="app-version" aria-label="App version">{versionOverride || APP_VERSION}</span>
                {rightSlot ? <div style={{ display: 'flex', alignItems: 'center' }}>{rightSlot}</div> : null}
            </div>
        </header>
    );
};

export default GlobalHeader;
