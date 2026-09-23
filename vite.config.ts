/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

// api-extractor 는 자기 TypeScript 를 내장하는데, 플러그인은 «프로젝트의»
// TypeScript lib 폴더를 넘긴다. 프로젝트가 그보다 새 TS 를 쓰면 내장 분석기가 새 lib 파일을
// 읽지 못해 `AsyncGenerator` 같은 표준 심볼에서 "Unable to follow symbol" 로 죽는다 — 워크스페이스
// 에서는 두 쪽이 같은 TS 로 호이스팅돼 가려지고 단독 설치에서만 드러난다. 그래서 api-extractor 가
// 실제로 로드하는 TypeScript 를 명시해 둘을 맞춘다.
const requireFromHere = createRequire(import.meta.url);
const extractorTypescript = dirname(
  requireFromHere.resolve('typescript/package.json', {
    paths: [dirname(requireFromHere.resolve('@microsoft/api-extractor/package.json'))],
  }),
);

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
      include: ['src/**/*'],
      bundleTypes: { invokeOptions: { typescriptCompilerFolder: extractorTypescript } },
    }),
  ]
});