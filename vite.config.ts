import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // The leaderboard API runs in the Worker; start it with `npm run dev:api`.
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    outDir: 'dist',
    // Phaser is one big chunk; don't warn about it on every build.
    chunkSizeWarningLimit: 2000,
  },
});
