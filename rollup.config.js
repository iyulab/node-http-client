import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/main.js',
        format: 'es',
      },
      {
        file: 'dist/main.cjs.js',
        format: 'cjs',
      },
      {
        file: 'dist/main.umd.js',
        format: 'umd',
        name: 'HttpClient',
      }
    ],
    plugins: [
      resolve({
        browser: true,
      }),
      commonjs(),
      terser({
        mangle: false,           // 난독화 비활성화
        format: {
          comments: true,        // 주석 유지
          beautify: true         // 코드 포맷을 일정하게 유지 (최소한의 가독성 제공)
        },
        compress: {
          passes: 2,             // 기본적인 최적화만 두 번 적용
        }
      }),
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ]
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/main.d.ts',
      format: 'es'
    },
    plugins: [
      dts({
        tsconfig: './tsconfig.json'
      })
    ]
  }
];
