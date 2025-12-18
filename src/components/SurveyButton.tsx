import React from 'react';
import ReactGA from 'react-ga4';

interface SurveyButtonProps {
    onClick: () => void;
}

const SurveyButton: React.FC<SurveyButtonProps> = ({ onClick }) => {
    const handleClick = () => {
        ReactGA.event({
            category: "User Interaction",
            action: "Open Survey"
        });
        onClick();
    };

    return (
        <button className="survey-button" onClick={handleClick}>
            Take Survey
        </button>
    );
};

export default SurveyButton;
