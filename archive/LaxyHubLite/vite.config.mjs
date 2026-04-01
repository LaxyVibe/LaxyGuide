import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Include .js files for JSX processing
      include: '**/*.{jsx,tsx,js,ts}',
      babel: {
        plugins: [],
        presets: [
          ['@babel/preset-react', { runtime: 'automatic' }]
        ]
      }
    })
  ],
  resolve: {
    alias: {
      // Enable importing from shared packages
      '@laxy/components': path.resolve(__dirname, '../../packages/LaxyComponents/src'),
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3001, // Dedicated port for LaxyHubLite
    open: true
  },
  build: {
    outDir: 'build',
    sourcemap: true
  },
  // Handle environment variables (change from REACT_APP_ to VITE_)
  envPrefix: 'VITE_',
  esbuild: {
    // Enable JSX in .js files
    jsx: 'automatic',
    include: [
      /src\/.*\.[jt]sx?$/,
      /.*\.js$/,
    ]
  },
  optimizeDeps: {
    esbuildOptions: {
      jsx: 'automatic',
      loader: {
        '.js': 'jsx',
      },
    },
  }
})
