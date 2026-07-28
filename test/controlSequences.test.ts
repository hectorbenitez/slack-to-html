import { describe, expect, it } from 'vitest'
import { escapeForSlack } from '../src/index.js'

describe('control sequences', () => {
  describe('user mentions', () => {
    it('renders the label', () => {
      expect(escapeForSlack('<@U123|someone>')).toBe('<span class="user-mention">@someone</span>')
    })

    it('renders the user name when present', () => {
      expect(escapeForSlack('<@U123>', { users: { U123: 'someone' } })).toBe(
        '<span class="user-mention">@someone</span>'
      )
    })

    it('escapes the original value when the user name is unknown', () => {
      expect(escapeForSlack('<@U123>')).toBe('&lt;@U123&gt;')
    })

    it('renders a bare user name literal', () => {
      expect(escapeForSlack('<@someone>')).toBe('<span class="user-mention">@someone</span>')
    })
  })

  describe('channel mentions', () => {
    it('renders the label', () => {
      expect(escapeForSlack('<#C123|channel>')).toBe('#channel')
    })

    it('renders the channel name when present', () => {
      expect(escapeForSlack('<#C123>', { channels: { C123: 'channel' } })).toBe('#channel')
    })

    it('escapes the original value when the channel name is unknown', () => {
      expect(escapeForSlack('<#C123>')).toBe('&lt;#C123&gt;')
    })

    it('renders a bare channel literal', () => {
      expect(escapeForSlack('<#channel>')).toBe('#channel')
    })
  })

  describe('hyperlinks', () => {
    it('renders an anchor tag', () => {
      expect(escapeForSlack('<https://example.com>')).toBe(
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>'
      )
    })

    it('renders the label inside the anchor tag when present', () => {
      expect(escapeForSlack('<https://example.com|Example>')).toBe(
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Example</a>'
      )
    })
  })

  describe('mail links', () => {
    it('renders a mailto anchor', () => {
      expect(escapeForSlack('<mailto:test@example.com>')).toBe(
        '<a href="mailto:test@example.com" target="_blank" rel="noopener noreferrer">test@example.com</a>'
      )
    })

    it('renders the label inside the anchor tag when present', () => {
      expect(escapeForSlack('<mailto:test@example.com|Test>')).toBe(
        '<a href="mailto:test@example.com" target="_blank" rel="noopener noreferrer">Test</a>'
      )
    })
  })

  describe('phone links', () => {
    it('renders a tel anchor', () => {
      expect(escapeForSlack('<tel:123-456-7890>')).toBe(
        '<a href="tel:123-456-7890">123-456-7890</a>'
      )
    })

    it('renders the label inside the tel anchor when present', () => {
      expect(escapeForSlack('<tel:123-456-7890|Call me!>')).toBe(
        '<a href="tel:123-456-7890">Call me!</a>'
      )
    })
  })

  describe('commands', () => {
    describe.each(['here', 'channel', 'group', 'everyone'])('<!%s>', (command) => {
      it('renders as a mention', () => {
        expect(escapeForSlack(`<!${command}>`)).toBe(`@${command}`)
      })

      it('ignores the label', () => {
        expect(escapeForSlack(`<!${command}|something_else>`)).not.toBe('@something_else')
      })
    })

    describe('subteams', () => {
      it('renders the label when present', () => {
        expect(escapeForSlack('<!subteam^S123|acme-eng>')).toBe('acme-eng')
      })

      it('renders the group name when present', () => {
        expect(escapeForSlack('<!subteam^S123>', { usergroups: { S123: 'acme-eng' } })).toBe(
          'acme-eng'
        )
      })

      it('escapes the original value when the group name is unknown', () => {
        expect(escapeForSlack('<!subteam^S123>')).toBe('&lt;!subteam^S123&gt;')
      })
    })

    describe('unknown commands', () => {
      it('renders the escaped label when present', () => {
        expect(escapeForSlack('<!foo|bar>')).toBe('&lt;bar&gt;')
      })

      it('renders the escaped literal otherwise', () => {
        expect(escapeForSlack('<!foo>')).toBe('&lt;foo&gt;')
      })
    })
  })

  describe('ordering', () => {
    it('renders commands and links in the same message', () => {
      expect(escapeForSlack('<!here|@here> <https://example.com>')).toBe(
        '@here <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>'
      )
    })
  })
})
