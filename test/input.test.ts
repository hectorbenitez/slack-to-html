import { describe, expect, it } from 'vitest'
import { buildSlackPatterns, escapeForSlack, escapeForSlackWithMarkdown } from '../src/index.js'

describe('input handling', () => {
  it.each([null, undefined, ''])('returns an empty string for %o', (badInput) => {
    expect(escapeForSlack(badInput)).toBe('')
    expect(escapeForSlackWithMarkdown(badInput)).toBe('')
  })

  it('leaves plain text untouched', () => {
    expect(escapeForSlack('hello world')).toBe('hello world')
  })

  it('does not mutate the options object', () => {
    const options = { users: { U123: 'someone' } }
    const snapshot = JSON.stringify(options)
    escapeForSlackWithMarkdown('<@U123>', options)
    expect(JSON.stringify(options)).toBe(snapshot)
  })
})

describe('buildSlackPatterns', () => {
  it('exposes the expressions used for matching', () => {
    const patterns = buildSlackPatterns()
    expect(Object.keys(patterns)).toContain('userMentionRegExp')
    expect(patterns.userMentionRegExp).toBeInstanceOf(RegExp)
  })
})
