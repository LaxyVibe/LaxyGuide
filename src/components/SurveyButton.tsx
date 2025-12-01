import React from 'react';

interface SurveyButtonProps {
    onClick: () => void;
}

const SurveyButton: React.FC<SurveyButtonProps> = ({ onClick }) => {
    return (
        <button className="survey-button" onClick={onClick}>
            Take Survey
        </button>
    );
};

export default SurveyButton;
