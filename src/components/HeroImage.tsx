import React from 'react';

interface HeroImageProps {
    src: string;
    alt: string;
}

const HeroImage: React.FC<HeroImageProps> = ({ src, alt }) => {
    return (
        <div className="hero-image">
            <img src={src} alt={alt} />
        </div>
    );
};

export default HeroImage;
