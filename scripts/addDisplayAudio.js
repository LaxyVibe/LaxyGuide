import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const poisDir = path.join(__dirname, '../src/content/pois');

if (!fs.existsSync(poisDir)) {
    console.error('POIs directory not found:', poisDir);
    process.exit(1);
}

const files = fs.readdirSync(poisDir).filter(file => file.endsWith('.md'));

files.forEach(file => {
    const filePath = path.join(poisDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(content);
    let changed = false;

    Object.keys(parsed.data).forEach(lang => {
        const langData = parsed.data[lang];
        if (typeof langData === 'object' && langData !== null) {
            if (langData.displayAudio === undefined) {
                // Create a new object to try to control order
                const newLangData = {};
                const keys = Object.keys(langData);
                
                // If 'subtitle' exists, insert after it. Otherwise at the end.
                const subtitleIndex = keys.indexOf('subtitle');
                
                if (subtitleIndex !== -1) {
                    keys.forEach(key => {
                        newLangData[key] = langData[key];
                        if (key === 'subtitle') {
                            newLangData['displayAudio'] = true;
                        }
                    });
                } else {
                    Object.assign(newLangData, langData);
                    newLangData['displayAudio'] = true;
                }
                
                parsed.data[lang] = newLangData;
                changed = true;
            }
        }
    });

    if (changed) {
        const newContent = matter.stringify(parsed.content, parsed.data);
        fs.writeFileSync(filePath, newContent);
        console.log(`Updated ${file}`);
    } else {
        console.log(`Skipped ${file}`);
    }
});
