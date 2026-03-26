import React from 'react';
import { useNavigate } from 'react-router-dom';
import backIcon from '../assets/icons/back.svg';

interface GlobalHeaderProps {
    title?: string;
    showBack?: boolean;
    onBack?: () => void;
    rightSlot?: React.ReactNode;
    style?: React.CSSProperties;
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({ title, showBack = true, onBack, rightSlot, style }) => {
    const navigate = useNavigate();

    return (
        <header className="global-header" style={style}>
            {showBack && (
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
            )}
            <h1>{title}</h1>
            {rightSlot ? <div style={{ display: 'flex', alignItems: 'center' }}>{rightSlot}</div> : null}
        </header>
    );
};

export default GlobalHeader;
