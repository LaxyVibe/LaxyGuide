import React from 'react';
import { useNavigate } from 'react-router-dom';

interface GlobalHeaderProps {
    title?: string;
    showBack?: boolean;
    onBack?: () => void;
    style?: React.CSSProperties;
}

const GlobalHeader: React.FC<GlobalHeaderProps> = ({ title, showBack = true, onBack, style }) => {
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
                    &larr;
                </button>
            )}
            <h1>{title}</h1>
        </header>
    );
};

export default GlobalHeader;
