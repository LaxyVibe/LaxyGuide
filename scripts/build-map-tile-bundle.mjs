import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import JSZip from 'jszip';
import matter from 'gray-matter';

const repoRoot = process.cwd();
const guidesDir = path.join(repoRoot, 'src', 'content', 'guides');
const publicDir = path.join(repoRoot, 'public');

async function listFilesRecursively(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFilesRecursively(fullPath));
            continue;
        }
        files.push(fullPath);
    }

    return files;
}

async function findGuideFrontmatter(guideId) {
    const guideFiles = await fs.readdir(guidesDir);

    for (const fileName of guideFiles) {
        if (!fileName.endsWith('.md')) continue;
        const fullPath = path.join(guidesDir, fileName);
        const raw = await fs.readFile(fullPath, 'utf8');
        const parsed = matter(raw);
        const frontmatter = parsed.data || {};

        for (const value of Object.values(frontmatter)) {
            if (!value || typeof value !== 'object') continue;
            if ('code' in value && String(value.code).toUpperCase() === guideId.toUpperCase()) {
                return frontmatter;
            }
        }
    }

    throw new Error(`Guide frontmatter not found for ${guideId}`);
}

function pickGuideAsset(frontmatter, fieldName) {
    const localized = frontmatter['en-US'];
    if (localized && typeof localized === 'object' && fieldName in localized) {
        return localized[fieldName];
    }

    for (const value of Object.values(frontmatter)) {
        if (!value || typeof value !== 'object') continue;
        if (fieldName in value) return value[fieldName];
    }

    return undefined;
}

function ensureFiniteNumber(value, label) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Missing or invalid ${label}`);
    }
    return parsed;
}

async function buildBundle(guideId) {
    const frontmatter = await findGuideFrontmatter(guideId);
    const mapPixelWidth = ensureFiniteNumber(pickGuideAsset(frontmatter, 'mapPixelWidth'), 'mapPixelWidth');
    const mapPixelHeight = ensureFiniteNumber(pickGuideAsset(frontmatter, 'mapPixelHeight'), 'mapPixelHeight');
    const mapTileMaxZoom = ensureFiniteNumber(pickGuideAsset(frontmatter, 'mapTileMaxZoom'), 'mapTileMaxZoom');

    const tileDir = path.join(publicDir, 'maps', guideId);
    const tileFiles = await listFilesRecursively(tileDir);
    if (tileFiles.length === 0) {
        throw new Error(`No tile files found under ${path.relative(repoRoot, tileDir)}`);
    }

    let mapImageSource = pickGuideAsset(frontmatter, 'mapImage');
    if (typeof mapImageSource !== 'string' || !mapImageSource.startsWith('/')) {
        const fallbacks = [
            path.join(publicDir, 'maps', `${guideId}.webp`),
            path.join(publicDir, 'maps', `${guideId}.png`),
            path.join(publicDir, 'maps', `${guideId}.jpg`)
        ];
        mapImageSource = null;
        for (const candidate of fallbacks) {
            try {
                await fs.access(candidate);
                mapImageSource = `/${path.relative(publicDir, candidate).split(path.sep).join('/')}`;
                break;
            } catch {
                continue;
            }
        }
    }

    const zip = new JSZip();
    const manifest = {
        schemaVersion: 1,
        guideId,
        createdAt: new Date().toISOString(),
        mapPixelWidth,
        mapPixelHeight,
        mapTileMaxZoom,
        tilePathTemplate: 'tiles/{z}/{x}/{y}.webp'
    };

    for (const filePath of tileFiles) {
        const relativeToTileDir = path.relative(tileDir, filePath).split(path.sep).join('/');
        const zipPath = path.posix.join('tiles', relativeToTileDir);
        zip.file(zipPath, await fs.readFile(filePath));
    }

    if (typeof mapImageSource === 'string' && mapImageSource.startsWith('/')) {
        const absoluteImagePath = path.join(publicDir, mapImageSource.slice(1));
        const imageFileName = `map-image${path.extname(absoluteImagePath).toLowerCase() || '.webp'}`;
        zip.file(imageFileName, await fs.readFile(absoluteImagePath));
        manifest.mapImageFile = imageFileName;
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const outputDir = path.join(publicDir, 'bundles', guideId);
    const outputPath = path.join(outputDir, 'map-tiles.zip');
    await fs.mkdir(outputDir, { recursive: true });

    const bundleBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
    await fs.writeFile(outputPath, bundleBuffer);

    return {
        outputPath,
        tileCount: tileFiles.length,
        bytes: bundleBuffer.byteLength
    };
}

const guideId = process.argv[2] || 'JPN-USAA-TEM-001';

buildBundle(guideId)
    .then(({ outputPath, tileCount, bytes }) => {
        console.log(`Created ${path.relative(repoRoot, outputPath)} with ${tileCount} tiles (${bytes} bytes)`);
    })
    .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
