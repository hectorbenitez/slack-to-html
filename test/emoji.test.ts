import { describe, expect, it } from 'vitest'
import { escapeForSlack } from '../src/index.js'

const customEmoji = {
  acme: 'https://example.com/favicon.ico',
  goodbye: 'alias:wave',
}

describe('emoji', () => {
  describe('standard emoji', () => {
    it('renders a shortname as code points', () => {
      expect(escapeForSlack(':wave:')).toBe('<span title=":wave:">&#x1F44B;</span>')
    })

    it('renders multiple emoji in a row', () => {
      expect(escapeForSlack(':wave: :wave:')).toBe(
        '<span title=":wave:">&#x1F44B;</span> <span title=":wave:">&#x1F44B;</span>'
      )
      expect(escapeForSlack(':wave::wave:')).toBe(
        '<span title=":wave:">&#x1F44B;</span><span title=":wave:">&#x1F44B;</span>'
      )
    })

    it('renders multi-code-point emoji', () => {
      expect(escapeForSlack(':flag-mx:')).toBe('<span title=":flag-mx:">&#x1F1F2;&#x1F1FD;</span>')
    })

    it('renders shortname aliases from the dataset', () => {
      expect(escapeForSlack(':thumbsup:')).toBe('<span title=":thumbsup:">&#x1F44D;</span>')
    })
  })

  describe('custom emoji', () => {
    it('renders an img tag', () => {
      expect(escapeForSlack(':acme:', { customEmoji })).toBe(
        '<img alt="acme" src="https://example.com/favicon.ico" title=":acme:" class="slack_emoji" />'
      )
    })

    it('follows an alias to a standard emoji', () => {
      expect(escapeForSlack(':goodbye:', { customEmoji })).toBe(
        '<span title=":goodbye:">&#x1F44B;</span>'
      )
    })

    it('renders multiple custom emoji in a row', () => {
      expect(escapeForSlack(':acme: :goodbye:', { customEmoji })).toBe(
        '<img alt="acme" src="https://example.com/favicon.ico" title=":acme:" class="slack_emoji" /> <span title=":goodbye:">&#x1F44B;</span>'
      )
      expect(escapeForSlack(':acme::goodbye:', { customEmoji })).toBe(
        '<img alt="acme" src="https://example.com/favicon.ico" title=":acme:" class="slack_emoji" /><span title=":goodbye:">&#x1F44B;</span>'
      )
    })

    it('overrides a standard emoji of the same name', () => {
      expect(escapeForSlack(':wave:', { customEmoji: { wave: 'https://example.com/w.png' } })).toBe(
        '<img alt="wave" src="https://example.com/w.png" title=":wave:" class="slack_emoji" />'
      )
    })
  })
})
