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

Output tiles are generated in:

- `public/maps/JPN-USAA-TEM-001/{z}/{x}/{y}.webp`

### Guide Metadata Fields

The USAA guide frontmatter can provide:

- `mapTileUrlTemplate`
- `mapTileMaxZoom`
- `mapPixelWidth`
- `mapPixelHeight`

When these are present, the map viewer prefers tiled rendering and keeps the original image URL as fallback.
