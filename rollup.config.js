import typescript from 'rollup-plugin-typescript2';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export default [
  // Main library build
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: pkg.main.replace('.js', '.esm.js'),
        format: 'esm',
        sourcemap: true
      }
    ],
    external: [
      ...Object.keys(pkg.peerDependencies || {}),
      ...Object.keys(pkg.dependencies || {}),
      'fs',
      'path',
      'crypto',
      'util'
    ],
    plugins: [
      typescript({
        typescript: require('typescript'),
        tsconfig: './tsconfig.json',
        clean: true
      })
    ]
  },
  // CLI build
  {
    input: 'src/cli/index.ts',
    output: {
      file: 'dist/cli/index.js',
      format: 'cjs',
      sourcemap: true,
      banner: '#!/usr/bin/env node'
    },
    external: [
      ...Object.keys(pkg.peerDependencies || {}),
      ...Object.keys(pkg.dependencies || {}),
      'fs',
      'path',
      'crypto',
      'util'
    ],
    plugins: [
      typescript({
        typescript: require('typescript'),
        tsconfig: './tsconfig.json',
        clean: false
      })
    ]
  }
];