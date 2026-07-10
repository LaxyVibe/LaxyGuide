import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { getGuideMapConfig } from './guide-map-config.mjs';

const execFile = promisify(execFileCallback);
const repoRoot = process.cwd();

async function generateTiles(guideId) {
    const config = getGuideMapConfig(guideId);
    if (!config) {
        throw new Error(`No local map config found for ${guideId}`);
    }

    const sourceImagePath = path.join(repoRoot, config.sourceImagePath);
    const tileOutputDir = path.join(repoRoot, 'public', config.tileOutputDir);

    await fs.rm(tileOutputDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(tileOutputDir), { recursive: true });

    await execFile('gdal2tiles', [
        '--xyz',
        '-p', 'raster',
        '-r', 'lanczos',
        '--tilesize=256',
        '--tiledriver=WEBP',
        '--webp-quality=85',
        '-z', `0-${config.mapTileMaxZoom}`,
        sourceImagePath,
        tileOutputDir
    ], {
        cwd: repoRoot
    });

    return {
        tileOutputDir
    };
}

const guideId = process.argv[2];
if (!guideId) {
    console.error('Usage: node scripts/generate-map-tiles.mjs <GUIDE_ID>');
    process.exitCode = 1;
} else {
    generateTiles(guideId)
        .then(({ tileOutputDir }) => {
            console.log(`Generated tiles in ${path.relative(repoRoot, tileOutputDir)}`);
        })
        .catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        });
}
