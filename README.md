# Laxy Lite Guide PWA

A Progressive Web App for multilingual tour guides with AI-powered content generation.

## 🚀 Live Deployment

- **Production**: https://laxy-guide-dev.web.app
- **CMS**: https://laxy-guide-dev.web.app/laxy-admin/
- **Guide Generator**: https://laxy-guide-dev.web.app/laxy-admin/guide-generator.html

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Hosting**: Firebase Hosting
- **Backend**: Firebase Functions (Cloud Run)
- **AI**: Google Vertex AI (Gemini 2.0 Flash)
- **CMS**: Decap CMS with GitHub backend
- **Media**: Cloudinary

## 📋 Features

- ✨ AI-powered guide generation from PDF documents
- 🌍 6-language support (EN, JA, KO, ZH-TW, ZH-CN, FR)
- 📱 Progressive Web App with offline support
- 🎨 Responsive design with dark mode
- 🔊 Audio guide support with TTML subtitles
- 📝 Content management via Decap CMS

## 🏃 Quick Start

### Prerequisites
```bash
npm install
firebase login
```

### Development
```bash
# Terminal 1: Firebase emulator
firebase emulators:start

# Terminal 2: Dev server
npm run dev
```

Access at http://localhost:5173

### Deployment
```bash
npm run build
firebase deploy
```

## 📖 Documentation

- **[Deployment Guide](./DEPLOYMENT.md)** - Complete deployment instructions
- **[Quick Start](./QUICK_START.md)** - Getting started guide
- **[Vertex AI Setup](./VERTEX_AI_SETUP.md)** - AI configuration

## 🎯 AI Guide Generator

Upload a PDF and generate complete multilingual tour guides:
1. Go to `/laxy-admin/guide-generator.html`
2. Upload your PDF (museum guide, tour brochure, etc.)
3. Set number of POIs to generate
4. AI creates structured content in 6 languages
5. Generate files directly to GitHub

## 📁 Project Structure

```
├── functions/              # Firebase Functions
│   └── src/index.ts       # PDF processing & auth
├── public/                # Static assets
│   └── laxy-admin/        # CMS interface
├── src/                   # React app
│   ├── components/        # React components
│   ├── content/           # Markdown guides
│   ├── pages/             # Route pages
│   └── utils/             # Utilities
└── firebase.json          # Firebase config
```

## 🔑 Environment Setup

Create `functions/.env`:
```bash
VERTEX_AI_PROJECT_ID=laxy-guide
VERTEX_AI_LOCATION=us-central1
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

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
