import React from 'react';
import { Hash, Info, Landmark, MapPinned, Sparkles } from 'lucide-react';

export interface HubActionItem {
    key: 'basicInfo' | 'map' | 'spot' | 'museum' | 'guideNumber';
    label: string;
    onClick: () => void;
    iconSrc?: string;
}

interface HubActionNavProps {
    items: HubActionItem[];
}

const ICON_MAP: Record<HubActionItem['key'], React.ReactNode> = {
    basicInfo: <Info size={20} strokeWidth={2.2} />,
    map: <MapPinned size={20} strokeWidth={2.2} />,
    spot: <Sparkles size={20} strokeWidth={2.2} />,
    museum: <Landmark size={20} strokeWidth={2.2} />,
    guideNumber: <Hash size={20} strokeWidth={2.2} />
};

const HubActionNav: React.FC<HubActionNavProps> = ({ items }) => {
    return (
        <section className="hub-action-nav" aria-label="Hub quick actions">
            {items.map((item) => (
                <button
                    key={item.key}
                    type="button"
                    className="hub-action-btn"
                    onClick={item.onClick}
                    aria-label={item.label}
                >
                    <span className="hub-action-icon" aria-hidden="true">
                        {item.iconSrc ? (
                            <img src={item.iconSrc} alt="" className="hub-action-icon-img" />
                        ) : (
                            ICON_MAP[item.key]
                        )}
                    </span>
                    <span className="hub-action-label">{item.label}</span>
                </button>
            ))}
        </section>
    );
};

export default HubActionNav;
