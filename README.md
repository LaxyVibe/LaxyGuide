# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Map Capture Cloud Bundles

Capture mode now supports Cloudinary-backed import/export bundles.

- Export uploads one ZIP bundle containing `map-pins.json`, map image, and `manifest.json`.
- Import loads bundle list for a guide, then replaces current map image and pin data.
- Cloud path format: `capture-bundles/<guideId>/<saveName>/<timestamp>/bundle.zip`.

### Netlify Environment Variables

Set these in Netlify site environment settings:

- `CLOUDINARY_API_SECRET` (required)
- `CLOUDINARY_CLOUD_NAME` (optional, defaults to `dui2mxeuh`)
- `CLOUDINARY_API_KEY` (optional, defaults to `314786376781459`)

### Endpoints

- `/.netlify/functions/cloudinary-sign` (POST): returns signed upload parameters.
- `/.netlify/functions/cloudinary-list-bundles` (GET `?guideId=...`): returns available bundles.

## Map Draw Firebase Export

`/JPN-USAA-TEM-001/map/draw` now uploads its export JSON to Firebase Storage instead of downloading a local file.

- Storage target: `gs://laxy-guide-dev.firebasestorage.app/maps/JPN-USAA-TEM-001-map-draw.json`
- Endpoint: `/.netlify/functions/upload-map-draw-json` (POST)
- Auth: Firebase Google sign-in on the client, Firebase ID token verification plus email allowlist on the Netlify function

### Frontend Environment Variables

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

The app now includes the `laxy-guide-dev` web config as a built-in default for `/map/draw`, and these env vars override it when present.

### Backend Environment Variables

- `FIREBASE_PROJECT_ID`
- `MAP_DRAW_ADMIN_EMAILS`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

## Decap Content Firebase Publish

`/laxy-admin` now includes a manual `Publish to Firebase Storage` action for mirroring `v2` markdown content from GitHub into Firebase Storage.

- Source of truth remains `src/content/guides/*.md` and `src/content/pois/*.md` on the `v2` branch.
- Export target:
  - `gs://laxy-guide-dev.firebasestorage.app/guides/<filename>.md`
  - `gs://laxy-guide-dev.firebasestorage.app/pois/<filename>.md`
- Manifest target:
  - `gs://laxy-guide-dev.firebasestorage.app/content-manifest.json`
- Endpoint:
  - `/.netlify/functions/export-content-markdown` (POST)
- Auth:
  - Firebase Google sign-in in the admin UI
  - Firebase ID token verification on the Netlify function
  - email allowlist via `CONTENT_EXPORT_ADMIN_EMAILS` or fallback `MAP_DRAW_ADMIN_EMAILS`

### Additional Environment Variables

- `CONTENT_EXPORT_ADMIN_EMAILS`
- `GITHUB_CONTENT_READ_TOKEN`
- `CONTENT_EXPORT_GITHUB_REPO` (optional, defaults to `LaxyVibe/LaxyGuide`)
- `CONTENT_EXPORT_GITHUB_BRANCH` (optional, defaults to `v2`)

## GDAL2Tiles Map Slicing (USAA)

The map viewer now supports local XYZ tiles for non-geographic guide maps.

### Source Asset

- `src/assets/map/usaa.webp`

### Generate Tiles

Requires GDAL with `gdal2tiles` available in PATH.

```bash
npm run tiles:usaa
```

This runs:

- `npm run tiles:clean:usaa`
- `npm run tiles:gen:usaa`
- `npm run map-bundle:usaa`

Output tiles are generated in:

- `public/maps/JPN-USAA-TEM-001/{z}/{x}/{y}.webp`

Uploadable ZIP bundle is generated in:

- `public/bundles/JPN-USAA-TEM-001/map-tiles.zip`

### Guide Metadata Fields

The USAA guide frontmatter can provide:

- `mapTileUrlTemplate`
- `mapTileBundleUrl`
- `mapTileMaxZoom`
- `mapPixelWidth`
- `mapPixelHeight`

When `mapTileBundleUrl` is present, the map viewer downloads the ZIP, extracts the tiles in-browser, and serves them to Leaflet from blob URLs. The original image URL remains available as a fallback for non-tiled rendering and calibration overlays.
