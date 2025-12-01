import React, { useState } from 'react';
import LanguageSwitcher from './LanguageSwitcher';

const LanguageButton: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="language-button-container">
            <button className="language-button" onClick={() => setIsOpen(!isOpen)}>
                🌐
            </button>
            {isOpen && (
                <div className="language-dropdown">
                    <LanguageSwitcher />
                </div>
            )}
        </div>
    );
};

export default LanguageButton;
