import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The PWA plugin is intentionally left out: tests run against the React app
// and the editor model, not the generated service worker.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    clearMocks: true,
  },
})
