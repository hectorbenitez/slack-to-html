/*
 * Differential check for changes to the rendering pipeline.
 *
 * The delimiter matcher in src/markdown.ts is difficult to change with
 * confidence: passes interact through window bounds, and a mistake tends to
 * surface only on inputs no test would think to write. This generates such inputs
 * from a fixed seed, records what the current code produces, and compares after a
 * change:
 *
 *   npm run fuzz:capture   # on the unchanged code
 *   ...make the change...
 *   npm run fuzz:compare
 *
 * A difference is not automatically a bug, but every one of them has to be
 * explained and, if intended, recorded in test/golden.test.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { escapeForSlackWithMarkdown } from '../src/index.js'

const REFERENCE_PATH = join(tmpdir(), 'slack-to-html-fuzz-reference.json')
const CASE_COUNT = 4000
const SEED = 20260728

/** Deterministic PRNG, so both runs generate byte-identical inputs. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let value = seed
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

/*
 * Fragments rather than characters, so that delimiters, control sequences and
 * entities land next to each other often enough to exercise how the passes
 * interact. Whitespace is included on its own because the space padded
 * delimiters treat it as part of the match.
 */
const FRAGMENTS = [
  '`',
  '```',
  '*',
  '_',
  '~',
  '&gt;',
  '&gt;&gt;&gt;',
  ' ',
  '\n',
  '\t',
  'a',
  'word',
  'x y',
  ':wave:',
  ':notanemoji:',
  '<@U123>',
  '<@U1|dave>',
  '<#C123|general>',
  '<https://example.com|link>',
  '<!here>',
  '<!subteam^S123|eng>',
  '<!date^1392734382^{date_num}|Feb 18>',
  '&amp;',
  '&lt;',
  '<b>',
  '"',
  "'",
  '&',
  '<',
  '>',
  ':',
  '/',
  '#',
  'https://ex.com/a#:~:text=hi',
]

const OPTIONS = {
  users: { U123: 'someone' },
  channels: { C123: 'general' },
  usergroups: { S123: 'eng' },
  customEmoji: { acme: 'https://example.com/a.png', goodbye: 'alias:wave' },
}

const generateInputs = (): string[] => {
  const random = mulberry32(SEED)
  const inputs: string[] = []
  for (let index = 0; index < CASE_COUNT; index += 1) {
    const fragmentCount = 1 + Math.floor(random() * 24)
    let text = ''
    for (let position = 0; position < fragmentCount; position += 1) {
      text += FRAGMENTS[Math.floor(random() * FRAGMENTS.length)]
    }
    inputs.push(text)
  }
  return inputs
}

const inputs = generateInputs()
const outputs = inputs.map((input) => escapeForSlackWithMarkdown(input, OPTIONS))

if (process.argv[2] === 'capture') {
  writeFileSync(REFERENCE_PATH, JSON.stringify({ seed: SEED, inputs, outputs }), 'utf8')
  console.log(`Captured ${inputs.length} cases to ${REFERENCE_PATH}`)
} else {
  let reference: { inputs: string[]; outputs: string[] }
  try {
    reference = JSON.parse(readFileSync(REFERENCE_PATH, 'utf8')) as typeof reference
  } catch {
    console.error(`No reference at ${REFERENCE_PATH}. Run "npm run fuzz:capture" first.`)
    process.exit(1)
  }
  if (reference.inputs.length !== inputs.length) {
    console.error('Reference was captured with different settings; recapture it.')
    process.exit(1)
  }

  let differences = 0
  for (const [index, expected] of reference.outputs.entries()) {
    if (outputs[index] === expected) {
      continue
    }
    differences += 1
    if (differences <= 10) {
      console.log(`\nDIFFERS for input ${JSON.stringify(inputs[index])}`)
      console.log(`  before: ${JSON.stringify(expected)}`)
      console.log(`  after:  ${JSON.stringify(outputs[index])}`)
    }
  }

  if (differences === 0) {
    console.log(`All ${inputs.length} cases identical to the reference`)
  } else {
    console.log(`\n${differences} of ${inputs.length} cases differ`)
    process.exit(1)
  }
}
