import matter from 'gray-matter';
import type { GuideData, POI } from '../types';

// Define interfaces for the raw frontmatter structure
interface GuideFrontmatter {
    [key: string]: {
        title?: string;
        code?: string;
        guideUnderlayImage?: string;
        pois?: string[];
    } | string | undefined;
}

interface POIFrontmatter {
    [key: string]: {
        number?: string;
        title?: string;
        hero?: string;
        audio?: string;
        subtitle?: string;
        metadata?: { label: string; value: string }[];
        content?: string;
        guide?: string;
    } | string | undefined;
}

export async function loadGuideData(lang: string): Promise<GuideData | null> {
    // 1. Load Guide File
    // We use eager: true to load content synchronously at build/runtime start
    // query: '?raw' ensures we get the file content as a string
    const guideFiles = import.meta.glob('/src/content/guides/*.md', { eager: true, query: '?raw', import: 'default' });
    const guidePaths = Object.keys(guideFiles);
    
    if (guidePaths.length === 0) {
        console.error('No guide files found in src/content/guides');
        return null;
    }
    
    // Assume single guide for now, or pick the first one found
    const guideContent = guideFiles[guidePaths[0]] as string;
    const guideParsed = matter(guideContent);
    const guideData = guideParsed.data as GuideFrontmatter;
    
    // Get guide details with fallback to en-US
    const guideLangData = (guideData[lang] as any) || {};
    const guideDefaultData = (guideData['en-US'] as any) || {};

    const guideTitle = guideLangData.title || guideDefaultData.title;
    const guideUnderlayImage = guideLangData.guideUnderlayImage || guideDefaultData.guideUnderlayImage;
    
    // 2. Load POI Files
    const poiFiles = import.meta.glob('/src/content/pois/*.md', { eager: true, query: '?raw', import: 'default' });
    const pois: POI[] = [];

    for (const path in poiFiles) {
        const poiContent = poiFiles[path] as string;
        const poiParsed = matter(poiContent);
        const poiData = poiParsed.data as POIFrontmatter;
        
        const poiLangData = (poiData[lang] as any) || {};
        const poiDefaultData = (poiData['en-US'] as any) || {};

        // Merge data: default first, then localized override
        const mergedPoi = { ...poiDefaultData, ...poiLangData };
        
        if (!mergedPoi.number) continue;

        pois.push({
            number: mergedPoi.number,
            title: mergedPoi.title || '',
            hero: mergedPoi.hero || '',
            withAudio: !!mergedPoi.audio,
            metadata: mergedPoi.metadata || [],
            content: mergedPoi.content || '',
            audio: mergedPoi.audio,
            subtitle: mergedPoi.subtitle
        });
    }

    // 3. Sort POIs by number
    pois.sort((a, b) => {
        const numA = parseInt(a.number, 10);
        const numB = parseInt(b.number, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return a.number.localeCompare(b.number);
    });

    return {
        guideTitle: guideTitle || '',
        guideUnderlayImage: guideUnderlayImage || '',
        pois
    };
}
