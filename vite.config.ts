import { defineConfig, PluginOption } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      name: 'HttpClient',
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => `main.${format}.js`,
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false, // 난독화 및 압축 비활성화
    sourcemap: false,
  },
  plugins: [
    dts({
      tsconfigPath: resolve(__dirname, 'tsconfig.json'),
      rollupTypes: true,
    }) as PluginOption,
  ]
});