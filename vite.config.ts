import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    // Phaser is one big chunk; don't warn about it on every build.
    chunkSizeWarningLimit: 2000,
  },
});
