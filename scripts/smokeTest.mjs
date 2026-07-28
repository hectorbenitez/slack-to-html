/*
 * Exercises the packed package the way a consumer would, from a directory where
 * the tarball is installed. Run with no build tooling present, so it can check
 * that the published artifact works on every Node version in `engines`.
 *
 *   npm install ./slack-to-html-*.tgz && node smokeTest.mjs
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import vm from 'node:vm'

const require = createRequire(import.meta.url)

const message = '<@U123> shipped *v2* :tada: see <https://example.com|the notes> <script>x</script>'
const expected =
  '<span class="user-mention">@david</span> shipped <span class="slack_bold">v2</span> ' +
  '<span title=":tada:">&#x1F389;</span> see ' +
  '<a href="https://example.com" target="_blank" rel="noopener noreferrer">the notes</a> ' +
  '&lt;script&gt;x&lt;/script&gt;'
const options = { users: { U123: 'david' } }

const esm = await import('slack-to-html')
assert.equal(esm.escapeForSlackWithMarkdown(message, options), expected, 'ESM entry')

const cjs = require('slack-to-html')
assert.equal(cjs.escapeForSlackWithMarkdown(message, options), expected, 'CommonJS entry')

const emojiSubpath = await import('slack-to-html/emoji')
assert.ok(Object.keys(emojiSubpath.emojiData).length > 1900, 'emoji subpath')

const umdPath = require
  .resolve('slack-to-html/package.json')
  .replace('package.json', 'dist/umd/index.umd.js')
assert.equal(
  require(umdPath).escapeForSlackWithMarkdown(message, options),
  expected,
  'UMD as CommonJS'
)

// A browser <script> tag has no module system, only a global object.
const sandbox = {}
vm.createContext(sandbox)
vm.runInContext(readFileSync(umdPath, 'utf8'), sandbox)
assert.equal(
  sandbox.slackToHtml.escapeForSlackWithMarkdown(message, options),
  expected,
  'UMD as a browser global'
)

assert.equal(esm.escapeForSlack(':notanemoji:'), ':notanemoji:', 'issue #4')
assert.equal(
  esm.escapeForSlack('https://ex.com/a#:~:text=hi'),
  'https://ex.com/a#:~:text=hi',
  'issue #1'
)
assert.equal(
  esm.escapeForSlack('<!date^1392734382^{date_short}|Feb 18, 2014>'),
  '<time datetime="2014-02-18T14:39:42.000Z" class="slack_date">Feb 18, 2014</time>',
  'dates'
)

console.log(`Smoke test passed on Node ${process.version}`)
