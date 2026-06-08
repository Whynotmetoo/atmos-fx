import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        react: 'src/react/index.ts',
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
    },
    emptyOutDir: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
