import { defineConfig } from 'vite'

export default defineConfig({
  root: 'docs',
  base: './', // Use relative paths for static assets
  build: {
    outDir: '../dist-docs',
    emptyOutDir: true,
  }
})
