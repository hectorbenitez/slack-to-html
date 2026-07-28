import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { escapeForSlackWithMarkdown } from '../src/index.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const readFixture = (name: string): string => readFileSync(join(fixturesDir, name), 'utf8')

describe('performance', () => {
  it('scans a long non-matching input quickly', () => {
    const input = readFixture('long_negative_input.txt')
    const started = performance.now()
    escapeForSlackWithMarkdown(input)
    expect(performance.now() - started).toBeLessThan(2000)
  })

  it('scans a long input full of matches quickly', () => {
    const input = readFixture('long_positive_input.txt')
    const started = performance.now()
    escapeForSlackWithMarkdown(input)
    expect(performance.now() - started).toBeLessThan(2000)
  })

  it('does not exhaust memory or the stack on many repeated replacements', () => {
    const input = readFixture('long_repetitive_block_quotes.txt')
    expect(() => escapeForSlackWithMarkdown(input)).not.toThrow()
  })

  it('does not consume stack proportional to the replacement count', () => {
    // Inline code has no replacement cap, and 1.x recursed once per replacement,
    // so this input occupied 5000 stack frames there. The rewrite is iterative.
    const input = `${'`c` '.repeat(5000)}end`
    expect(() => escapeForSlackWithMarkdown(input)).not.toThrow()
  })

  it('does not scan the whole text once per window for an absent delimiter', () => {
    // Inline code splits the text into one window per span, and a pass that finds
    // nothing still had to scan to the end of the text for every one of them. The
    // bound is loose because it is checked on shared CI machines; the point is
    // that the cost stays far below the ~500ms this took beforehand.
    const input = `${'`c` '.repeat(2000)}end`
    const started = performance.now()
    escapeForSlackWithMarkdown(input)
    expect(performance.now() - started).toBeLessThan(200)
  })
})
