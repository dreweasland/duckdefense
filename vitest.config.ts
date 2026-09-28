import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Game logic only. Phaser scenes stay out of tests.
    include: ['src/logic/**/*.test.ts'],
    environment: 'node',
  },
});
