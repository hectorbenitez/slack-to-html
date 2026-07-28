import { writeFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const UMD_OUT_DIR = 'dist/umd'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/emoji.ts'],
    format: ['esm', 'cjs'],
    target: 'es2022',
    dts: true,
    sourcemap: true,
    treeshake: true,
    clean: true,
  },
  // Standalone build for <script> / CDN consumers.
  {
    entry: ['src/index.ts'],
    format: ['umd'],
    globalName: 'slackToHtml',
    target: 'es2022',
    outDir: UMD_OUT_DIR,
    minify: true,
    dts: false,
    clean: false,
    hooks: {
      // The package is "type": "module", which would make Node parse the UMD
      // wrapper as ESM and drop its exports. Mark the directory as CommonJS.
      'build:done': () => {
        writeFileSync(`${UMD_OUT_DIR}/package.json`, '{ "type": "commonjs" }\n', 'utf8')
      },
    },
  },
])
