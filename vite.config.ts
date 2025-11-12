import { defineConfig, PluginOption } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false, // 난독화 및 압축 비활성화
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: (format, entry) => {
        return format === 'es' ? 'index.js' : `${entry}.${format}.js`;
      }
    },
  },
  plugins: [
    dts({
      outDir: 'dist',
      tsconfigPath: resolve(__dirname, 'tsconfig.json'),
      rollupTypes: true,
      insertTypesEntry: true,
    }) as PluginOption,
  ]
});