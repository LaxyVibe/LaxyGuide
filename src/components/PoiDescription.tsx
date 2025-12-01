import React from 'react';

interface PoiDescriptionProps {
    title: string;
    number: string;
    content: string;
    subtitle?: string;
}

const PoiDescription: React.FC<PoiDescriptionProps> = ({ title, number, content, subtitle }) => {
    return (
        <div className="poi-description">
            <div className="poi-header">
                <span className="poi-number">{number}</span>
                <h2>{title}</h2>
            </div>
            {subtitle && <h3 className="poi-subtitle">{subtitle}</h3>}
            <p className="poi-content">{content}</p>
        </div>
    );
};

export default PoiDescription;
