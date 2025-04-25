import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
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
        format: 'esm',
      },
      {
        file: 'dist/main.cjs.js',
        format: 'cjs',
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
      })
    ]
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/main.d.ts',
      format: 'esm'
    },
    plugins: [dts()]
  }
];
