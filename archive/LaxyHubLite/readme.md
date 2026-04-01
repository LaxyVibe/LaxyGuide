# LaxyHub

LaxyHub is a modern React-based travel companion application that provides local tourism information and recommendations.

## Overview

LaxyHub serves as the main hub for discovering local attractions, managing travel itineraries, and accessing personalized recommendations. Built with React and integrated into an Nx monorepo structure.

## Technology Stack

- **Frontend**: React 18, Material-UI (MUI)
- **Build Tool**: React Scripts (Create React App)
- **Testing**: Jest, React Testing Library
- **Styling**: CSS, Material-UI theming
- **Monorepo**: Nx workspace
- **Package Manager**: npm

## Development

### Prerequisites

- Node.js 22+
- npm

### Getting Started

1. **Install dependencies** (from the monorepo root):
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npx nx serve laxy-hub
   ```
   
   The application will be available at `http://localhost:4200`

### Available Commands

From the monorepo root, you can run:

- `npx nx serve laxy-hub` - Start development server
- `npx nx build laxy-hub` - Build for production
- `npx nx test laxy-hub` - Run tests
- `npx nx lint laxy-hub` - Run ESLint
- `npx nx fetch-api laxy-hub` - Fetch API data for development

### Project Structure

```
apps/LaxyHub/
├── public/           # Static assets
├── src/
│   ├── components/   # React components
│   ├── config/       # Configuration files
│   ├── context/      # React contexts
│   ├── hooks/        # Custom hooks
│   ├── mocks/        # Mock data for development
│   ├── utils/        # Utility functions
│   └── ...
├── scripts/          # Build and utility scripts
└── build/           # Production build output
```

## Features

- **Multi-language Support**: Supports English, Japanese, Korean, and Chinese
- **Local Tourism**: Discover nearby attractions and points of interest
- **Responsive Design**: Optimized for mobile and desktop
- **PWA Ready**: Progressive Web App capabilities
- **Analytics Integration**: Google Analytics tracking
- **QR Code Generation**: For sharing and quick access

## Environment

The application runs on port 4200 in development mode and supports hot reloading for efficient development.

## Build & Deployment

To create a production build:

```bash
npx nx build laxy-hub
```

The build artifacts will be stored in the `apps/LaxyHub/build/` directory.

## Contributing

This project is part of the LaxyVibe monorepo. Follow the established patterns and coding standards when contributing.