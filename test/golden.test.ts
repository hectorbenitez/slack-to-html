import { describe, expect, it } from 'vitest'
import { escapeForSlack, escapeForSlackWithMarkdown } from '../src/index.js'
import type { SlackEscapeOptions } from '../src/index.js'
import goldenCorpus from './fixtures/golden.json' with { type: 'json' }

interface GoldenCase {
  group: string
  input: string | null
  inputIsUndefined: boolean
  options: (SlackEscapeOptions & Record<string, unknown>) | null
  output: string
}

/*
 * test/fixtures/golden.json was captured from the 1.x implementation (see
 * scripts/captureGolden.js) before the TypeScript rewrite. Every case must still
 * render identically unless it is listed below as a deliberate 2.0 change, in
 * which case the new behavior is asserted in its own test file instead.
 */
const INTENTIONAL_CHANGES: { group: string; input: string; reason: string }[] = [
  { group: 'plain', input: 'a & b', reason: 'a bare ampersand is now encoded' },
  {
    group: 'link',
    input: '<http://example.com/a/b?c=d&e=f>',
    reason: 'an ampersand inside an href is now encoded',
  },
  { group: 'command', input: '<!foo|bar>', reason: 'an unknown command label is now escaped' },
  { group: 'command', input: '<!foo>', reason: 'an unknown command literal is now escaped' },
  {
    group: 'knownBug-issue1-urlColons',
    input: 'https://ex.com/a#:~:text=hello%20world',
    reason: 'issue #1: colons inside a URL are no longer consumed as emoji',
  },
  {
    group: 'knownBug-issue4-unknownEmoji',
    input: 'hello :notanemoji: world',
    reason: 'issue #4: an unknown shortname keeps its colons',
  },
  {
    group: 'knownBug-issue4-unknownEmoji',
    input: ':customEmoji:',
    reason: 'issue #4: an unknown shortname keeps its colons',
  },
  {
    group: 'knownBug-rawHtml',
    input: '<script>alert(1)</script>',
    reason: 'raw HTML in the message body is now escaped',
  },
  {
    group: 'knownBug-rawHtml',
    input: '<img src=x onerror=alert(1)>',
    reason: 'raw HTML in the message body is now escaped',
  },
  {
    group: 'knownBug-attrBreakout',
    input: ':evil:',
    reason: 'a custom emoji URL that breaks out of the src attribute is rejected',
  },
  {
    group: 'knownBug-attrBreakout',
    input: '<@U1|"><b>label</b>>',
    reason: 'HTML following a mention label is now escaped',
  },
  {
    group: 'knownBug-javascriptUrl',
    input: '<javascript:alert(1)|click me>',
    reason: 'an unsafe URL scheme is not rendered as a link',
  },
]

const identify = (group: string, input: string | null): string => `${group}\u0000${String(input)}`

const changedCases = new Map(
  INTENTIONAL_CHANGES.map((change) => [identify(change.group, change.input), change.reason])
)

const corpus = goldenCorpus as GoldenCase[]

const render = (testCase: GoldenCase): string => {
  const input = testCase.inputIsUndefined ? undefined : testCase.input
  const options = testCase.options
  if (!options) {
    return escapeForSlack(input)
  }
  return options.markdown
    ? escapeForSlackWithMarkdown(input, options)
    : escapeForSlack(input, options)
}

const isChanged = (testCase: GoldenCase): boolean =>
  changedCases.has(identify(testCase.group, testCase.input))

const preserved = corpus.filter((testCase) => !isChanged(testCase))
const changed = corpus.filter(isChanged)

describe('1.x compatibility', () => {
  it('covers a meaningful corpus', () => {
    expect(preserved.length).toBeGreaterThan(60)
  })

  describe.each(preserved)('$group: $input', (testCase) => {
    it('renders identically to 1.x', () => {
      expect(render(testCase)).toBe(testCase.output)
    })
  })
})

describe('deliberate 2.0 changes', () => {
  it('every listed change is present in the corpus', () => {
    expect(changed).toHaveLength(INTENTIONAL_CHANGES.length)
  })

  describe.each(changed)('$group: $input', (testCase) => {
    it('no longer matches 1.x', () => {
      // Guards against a fix silently regressing back to the 1.x output.
      expect(render(testCase)).not.toBe(testCase.output)
    })
  })
})
