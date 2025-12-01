import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getLanguageFromQuery } from '../utils/languageUtils';
import { useTranslation } from '../hooks/useTranslation';

interface StartButtonProps {
    poiCount?: number;
    firstPoiId?: string;
}

const StartButton: React.FC<StartButtonProps> = ({ poiCount, firstPoiId }) => {
    const { guideId } = useParams<{ guideId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const lang = getLanguageFromQuery(searchParams);
    const { t } = useTranslation(lang);

    const handleClick = () => {
        const path = poiCount === 1 && firstPoiId ? `/${guideId}/${firstPoiId}?t=${lang}` : `/${guideId}/list?t=${lang}`;
        if ('startViewTransition' in document) {
            document.startViewTransition(() => {
                navigate(path);
            });
        } else {
            navigate(path);
        }
    };

    return (
        <button className="start-button" onClick={handleClick}>
            {t('startButton.next')}
        </button>
    );
};

export default StartButton;
