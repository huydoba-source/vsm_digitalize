import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [
    svelte({
      // Don't compile node_modules packages with runes mode
      compilerOptions: {
        // Per-component runes detection
      },
    }),
    viteSingleFile() // <--- Thêm plugin gom Single File vào đây
  ],
  optimizeDeps: {
    // Tối ưu thư viện vẽ sơ đồ Canvas kéo thả
    include: ['@xyflow/svelte'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
  }
})