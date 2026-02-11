/**
 * TTML (Timed Text Markup Language) parser utility
 */

import { type Subtitle, type Slide } from '../types';

export interface TTMLData {
    audioSources: Record<string, string>; // language code -> mp3 url
    subtitles: Record<string, Subtitle[]>; // language code -> subtitles
    slides: Record<string, Slide[]>; // language code -> slides
}

/**
 * Converts TTML timestamp (HH:MM:SS.mmm) to seconds
 */
function parseTime(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;

    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);

    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parses a TTML string into a structured object
 */
export function parseTTML(xmlString: string): TTMLData {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const data: TTMLData = {
        audioSources: {},
        subtitles: {},
        slides: {}
    };

    // Parse Metadata for Audio Sources
    const audioTags = xmlDoc.getElementsByTagNameNS("http://example.com/my", "audio");
    for (let i = 0; i < audioTags.length; i++) {
        const tag = audioTags[i];
        const lang = tag.getAttribute("xml:lang");
        const src = tag.getAttribute("src");
        if (lang && src) {
            data.audioSources[lang] = src;
        }
    }

    // Parse Body for Subtitles and Slides
    const divTags = xmlDoc.getElementsByTagName("div");
    for (let i = 0; i < divTags.length; i++) {
        const div = divTags[i];
        const type = div.getAttributeNS("http://example.com/my", "type");
        const lang = div.getAttribute("xml:lang");

        if (!lang) continue;

        const pTags = div.getElementsByTagName("p");
        const items: any[] = [];

        for (let j = 0; j < pTags.length; j++) {
            const p = pTags[j];
            const begin = parseTime(p.getAttribute("begin") || "");
            const end = parseTime(p.getAttribute("end") || "");

            if (type === "subtitles") {
                items.push({
                    startTime: begin,
                    endTime: end,
                    text: p.textContent || ""
                });
            } else if (type === "slides") {
                const image = p.getAttributeNS("http://example.com/my", "image");
                if (image) {
                    items.push({
                        startTime: begin,
                        endTime: end,
                        image: image
                    });
                }
            }
        }

        if (type === "subtitles") {
            data.subtitles[lang] = items;
        } else if (type === "slides") {
            data.slides[lang] = items;
        }
    }

    return data;
}
