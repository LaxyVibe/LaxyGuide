import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { getGuideMapConfig, getGuideMapSourceImagePath } from './guide-map-config.mjs';

const execFile = promisify(execFileCallback);
const repoRoot = process.cwd();

async function generateTileLayer(sourceImagePath, tileOutputDir, mapTileMaxZoom) {
    await fs.access(sourceImagePath);
    await fs.mkdir(path.dirname(tileOutputDir), { recursive: true });

    await execFile('gdal2tiles', [
        '--xyz',
        '-p', 'raster',
        '-r', 'lanczos',
        '--tilesize=256',
        '--tiledriver=WEBP',
        '--webp-quality=85',
        '--webviewer=none',
        '-z', `0-${mapTileMaxZoom}`,
        sourceImagePath,
        tileOutputDir
    ], {
        cwd: repoRoot
    });
}

function resolveSourceImagePath(configuredPath) {
    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.join(repoRoot, configuredPath);
}

async function generateTiles(guideId) {
    const config = getGuideMapConfig(guideId);
    if (!config) {
        throw new Error(`No local map config found for ${guideId}`);
    }

    const configuredSourceImagePath = getGuideMapSourceImagePath(guideId, process.argv[3]);
    if (!configuredSourceImagePath) {
        throw new Error(`No source image path configured for ${guideId}. Pass one as the second argument.`);
    }

    const tileOutputDir = path.join(repoRoot, 'public', config.tileOutputDir);
    await fs.rm(tileOutputDir, { recursive: true, force: true });

    const sourceImagePath = resolveSourceImagePath(configuredSourceImagePath);
    const isLayeredMap = Boolean(config.baseSourceImagePath || config.labelSourceImagePaths);
    const baseTileOutputDir = isLayeredMap
        ? path.join(tileOutputDir, 'base')
        : tileOutputDir;
    await generateTileLayer(sourceImagePath, baseTileOutputDir, config.mapTileMaxZoom);

    const labelSourceImagePaths = config.labelSourceImagePaths ?? {};
    for (const [language, labelSourcePath] of Object.entries(labelSourceImagePaths)) {
        const absoluteLabelSourcePath = resolveSourceImagePath(labelSourcePath);
        const labelTileOutputDir = path.join(tileOutputDir, 'labels', language);
        await generateTileLayer(absoluteLabelSourcePath, labelTileOutputDir, config.mapTileMaxZoom);
    }

    return {
        tileOutputDir,
        labelLanguages: Object.keys(labelSourceImagePaths)
    };
}

const guideId = process.argv[2];
if (!guideId) {
    console.error('Usage: node scripts/generate-map-tiles.mjs <GUIDE_ID> [SOURCE_IMAGE_PATH]');
    process.exitCode = 1;
} else {
    generateTiles(guideId)
        .then(({ tileOutputDir, labelLanguages }) => {
            console.log(`Generated tiles in ${path.relative(repoRoot, tileOutputDir)}`);
            if (labelLanguages.length > 0) {
                console.log(`Generated label layers for: ${labelLanguages.join(', ')}`);
            }
        })
        .catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        });
}
