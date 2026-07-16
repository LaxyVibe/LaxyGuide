import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import JSZip from 'jszip';
import matter from 'gray-matter';
import { getGuideMapConfig, getGuideMapSourceImagePath } from './guide-map-config.mjs';

const repoRoot = process.cwd();
const guidesDir = path.join(repoRoot, 'src', 'content', 'guides');
const publicDir = path.join(repoRoot, 'public');
const execFile = promisify(execFileCallback);

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

async function fileExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function readImageDimensions(imagePath) {
    const { stdout } = await execFile('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', imagePath], {
        cwd: repoRoot
    });
    const widthMatch = stdout.match(/pixelWidth:\s+(\d+)/);
    const heightMatch = stdout.match(/pixelHeight:\s+(\d+)/);

    const width = widthMatch ? Number(widthMatch[1]) : NaN;
    const height = heightMatch ? Number(heightMatch[1]) : NaN;
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error(`Could not read image dimensions for ${path.relative(repoRoot, imagePath)}`);
    }

    return { width, height };
}

async function getGuideMapMetadata(guideId, sourceImageOverridePath) {
    const config = getGuideMapConfig(guideId);
    if (config) {
        const configuredSourceImagePath = getGuideMapSourceImagePath(guideId, sourceImageOverridePath);
        if (!configuredSourceImagePath) {
            throw new Error(`No source image path configured for ${guideId}. Pass one as the second argument.`);
        }

        const sourceImagePath = path.isAbsolute(configuredSourceImagePath)
            ? configuredSourceImagePath
            : path.join(repoRoot, configuredSourceImagePath);
        if (!await fileExists(sourceImagePath)) {
            throw new Error(`Map source image not found for ${guideId}: ${configuredSourceImagePath}`);
        }

        const dimensions = await readImageDimensions(sourceImagePath);

        return {
            mapPixelWidth: dimensions.width,
            mapPixelHeight: dimensions.height,
            mapTileMaxZoom: config.mapTileMaxZoom,
            mapImagePath: sourceImagePath,
            tileDir: path.join(publicDir, config.tileOutputDir),
            bundleOutputDir: path.join(publicDir, config.bundleOutputDir)
        };
    }

    if (!await fileExists(guidesDir)) {
        throw new Error(`Guide metadata directory is missing: ${path.relative(repoRoot, guidesDir)}`);
    }

    const frontmatter = await findGuideFrontmatter(guideId);
    return {
        mapPixelWidth: ensureFiniteNumber(pickGuideAsset(frontmatter, 'mapPixelWidth'), 'mapPixelWidth'),
        mapPixelHeight: ensureFiniteNumber(pickGuideAsset(frontmatter, 'mapPixelHeight'), 'mapPixelHeight'),
        mapTileMaxZoom: ensureFiniteNumber(pickGuideAsset(frontmatter, 'mapTileMaxZoom'), 'mapTileMaxZoom'),
        mapImageSource: pickGuideAsset(frontmatter, 'mapImage'),
        tileDir: path.join(publicDir, 'maps', guideId),
        bundleOutputDir: path.join(publicDir, 'bundles', guideId)
    };
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
    const metadata = await getGuideMapMetadata(guideId, process.argv[3]);
    const {
        mapPixelWidth,
        mapPixelHeight,
        mapTileMaxZoom,
        tileDir,
        bundleOutputDir
    } = metadata;
    const tileFiles = (await listFilesRecursively(tileDir)).filter((filePath) => path.extname(filePath).toLowerCase() === '.webp');
    if (tileFiles.length === 0) {
        throw new Error(`No tile files found under ${path.relative(repoRoot, tileDir)}`);
    }

    let absoluteImagePath = metadata.mapImagePath ?? null;
    if (!absoluteImagePath) {
        let mapImageSource = metadata.mapImageSource;
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

        if (typeof mapImageSource === 'string' && mapImageSource.startsWith('/')) {
            absoluteImagePath = path.join(publicDir, mapImageSource.slice(1));
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

    if (absoluteImagePath) {
        const imageFileName = `map-image${path.extname(absoluteImagePath).toLowerCase() || '.webp'}`;
        zip.file(imageFileName, await fs.readFile(absoluteImagePath));
        manifest.mapImageFile = imageFileName;
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const outputPath = path.join(bundleOutputDir, 'map-tiles.zip');
    await fs.mkdir(bundleOutputDir, { recursive: true });

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

const guideId = process.argv[2];
if (!guideId) {
    console.error('Usage: node scripts/build-map-tile-bundle.mjs <GUIDE_ID> [SOURCE_IMAGE_PATH]');
    process.exitCode = 1;
} else {
    buildBundle(guideId)
        .then(({ outputPath, tileCount, bytes }) => {
            console.log(`Created ${path.relative(repoRoot, outputPath)} with ${tileCount} tiles (${bytes} bytes)`);
        })
        .catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        });
}
