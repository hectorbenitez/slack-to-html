import { describe, expect, it } from 'vitest'
import { escapeForSlack, escapeForSlackWithMarkdown } from '../src/index.js'

describe('issue #1: URLs containing colons', () => {
  const textFragmentUrl =
    'https://datapastry.com/blog/why-i-dont-use-jupyter-notebooks-and-you-shouldnt-either/#:~:text=This%20is%20generally%20considered%20bad,a%20horribly%20large%20state%20machine'

  it('leaves a bare URL with a text fragment untouched', () => {
    expect(escapeForSlack(textFragmentUrl)).toBe(textFragmentUrl)
  })

  it('leaves a shorter text fragment untouched', () => {
    expect(escapeForSlack('https://ex.com/a#:~:text=hello%20world')).toBe(
      'https://ex.com/a#:~:text=hello%20world'
    )
  })

  it('renders a wrapped URL with a text fragment as a link', () => {
    expect(escapeForSlack(`<${textFragmentUrl}>`)).toBe(
      `<a href="${textFragmentUrl}" target="_blank" rel="noopener noreferrer">${textFragmentUrl}</a>`
    )
  })

  it('leaves a URL with a port untouched', () => {
    expect(escapeForSlack('http://localhost:3000/path')).toBe('http://localhost:3000/path')
  })

  it('still expands emoji written next to a URL', () => {
    expect(escapeForSlack(':wave: https://ex.com/a#:~:text=hi :wave:')).toBe(
      '<span title=":wave:">&#x1F44B;</span> https://ex.com/a#:~:text=hi <span title=":wave:">&#x1F44B;</span>'
    )
  })
})

describe('issue #4: unknown emoji shortnames', () => {
  it('keeps the colons of an unknown shortname', () => {
    expect(escapeForSlack(':customEmoji:')).toBe(':customEmoji:')
    expect(escapeForSlack('hello :notanemoji: world')).toBe('hello :notanemoji: world')
  })

  it('keeps a time range written with colons', () => {
    expect(escapeForSlack('the meeting is 10:30:00 to 11:00')).toBe(
      'the meeting is 10:30:00 to 11:00'
    )
  })

  it('keeps the colons of an alias that points nowhere', () => {
    expect(escapeForSlack(':broken:', { customEmoji: { broken: 'alias:does_not_exist' } })).toBe(
      ':broken:'
    )
  })

  it('does not loop forever on a circular alias', () => {
    expect(escapeForSlack(':a:', { customEmoji: { a: 'alias:b', b: 'alias:a' } })).toBe(':a:')
  })

  it('still expands a known shortname in the same message', () => {
    expect(escapeForSlack(':notanemoji: :wave:')).toBe(
      ':notanemoji: <span title=":wave:">&#x1F44B;</span>'
    )
  })

  it('keeps unknown shortnames inside markdown', () => {
    expect(escapeForSlackWithMarkdown('*bold :notanemoji:*')).toBe(
      '<span class="slack_bold">bold :notanemoji:</span>'
    )
  })
})
