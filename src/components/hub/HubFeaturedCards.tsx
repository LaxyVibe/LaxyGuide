import React from 'react';

export interface HubFeaturedItem {
    id: string;
    title: string;
    image: string;
    onClick: () => void;
}

interface HubFeaturedCardsProps {
    heading: string;
    items: HubFeaturedItem[];
    variant?: 'default' | 'grid';
    showIdBadge?: boolean;
}

const HubFeaturedCards: React.FC<HubFeaturedCardsProps> = ({
    heading,
    items,
    variant = 'default',
    showIdBadge = false
}) => {
    if (items.length === 0) return null;

    if (variant === 'grid') {
        return (
            <section className="hub-featured" aria-label={heading}>
                <h2 className="hub-featured-title">{heading}</h2>
                <div className="hub-featured-grid hub-featured-grid--full">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="hub-featured-grid-card"
                            onClick={item.onClick}
                            aria-label={item.title}
                        >
                            <span className="hub-featured-grid-media">
                                <img src={item.image} alt={item.title} loading="lazy" />
                            </span>
                            <span className="hub-featured-grid-caption">
                                <span className="hub-featured-grid-meta">
                                    {showIdBadge && <em className="hub-featured-id">{item.id}</em>}
                                    <strong>{item.title}</strong>
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            </section>
        );
    }

    const [first, ...rest] = items;

    return (
        <section className="hub-featured" aria-label={heading}>
            <h2 className="hub-featured-title">{heading}</h2>

            <button
                type="button"
                className="hub-featured-main-card"
                onClick={first.onClick}
                aria-label={first.title}
            >
                <img src={first.image} alt={first.title} loading="lazy" />
                <span className="hub-featured-main-label">{first.title}</span>
            </button>

            {rest.length > 0 && (
                <div className="hub-featured-grid">
                    {rest.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="hub-featured-grid-card"
                            onClick={item.onClick}
                            aria-label={item.title}
                        >
                            <span className="hub-featured-grid-media">
                                <img src={item.image} alt={item.title} loading="lazy" />
                            </span>
                            <span className="hub-featured-grid-caption">
                                <span className="hub-featured-grid-caption-text">{item.title}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
};

export default HubFeaturedCards;
