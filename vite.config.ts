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
    // Keep Phaser in its own file: it rarely changes, so players' browsers keep their
    // copy when only the game's code is updated.
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] } },
    },
  },
});
