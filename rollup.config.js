import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

// @ts-check
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
      terser(),
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
