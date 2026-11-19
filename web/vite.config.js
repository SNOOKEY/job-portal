import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Essential for GitHub Pages subpath deployment
  server: {
    port: 3000,
    open: false,
  },
});
