import { describe, expect, it } from 'vitest'
import { escapeForSlack, escapeForSlackWithMarkdown } from '../src/index.js'

describe('body escaping', () => {
  it('escapes raw HTML', () => {
    expect(escapeForSlack('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
    expect(escapeForSlack('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    )
  })

  it('escapes a bare ampersand', () => {
    expect(escapeForSlack('a & b')).toBe('a &amp; b')
  })

  it('leaves entities that Slack already encoded alone', () => {
    expect(escapeForSlack('a &amp; b')).toBe('a &amp; b')
    expect(escapeForSlack('&lt;script&gt;')).toBe('&lt;script&gt;')
    expect(escapeForSlack('&#39; &#x27; &quot;')).toBe('&#39; &#x27; &quot;')
  })

  it('is idempotent, so re-rendering does not double-escape', () => {
    const once = escapeForSlack('a & b <c> &amp; d')
    expect(escapeForSlack(once)).toBe(once)
  })

  it('escapes an ampersand that only looks like an entity', () => {
    expect(escapeForSlack('&notanentity a&b')).toBe('&amp;notanentity a&amp;b')
  })

  it('keeps working with the block quote markdown Slack encodes for us', () => {
    expect(escapeForSlackWithMarkdown('&gt;&gt;&gt;quoted')).toBe(
      '<div class="slack_block">quoted</div>'
    )
  })

  it('treats a raw angle bracket as a block quote once escaped', () => {
    expect(escapeForSlackWithMarkdown('>quoted')).toBe('<span class="slack_block">quoted</span>')
  })

  describe('with escapeHtml disabled', () => {
    it('passes raw HTML through', () => {
      expect(escapeForSlack('<b>bold</b>', { escapeHtml: false })).toBe('<b>bold</b>')
    })

    it('still escapes interpolated values', () => {
      expect(
        escapeForSlack('<@U123>', {
          users: { U123: '<img src=x onerror=alert(1)>' },
          escapeHtml: false,
        })
      ).toBe('<span class="user-mention">@&lt;img src=x onerror=alert(1)&gt;</span>')
    })

    it('still rejects unsafe URL schemes', () => {
      expect(
        escapeForSlack(':evil:', {
          customEmoji: { evil: 'javascript:alert(1)' },
          escapeHtml: false,
        })
      ).toBe(':evil:')
    })
  })
})

describe('attribute escaping', () => {
  it('escapes a quote in a link label', () => {
    expect(escapeForSlack('<https://example.com|a "quoted" label>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">a "quoted" label</a>'
    )
  })

  it('escapes a quote that would break out of an href', () => {
    const rendered = escapeForSlack('<https://example.com/" onmouseover="alert(1)|link>')
    expect(rendered).toContain('&quot; onmouseover=&quot;alert(1)')
    expect(rendered).not.toContain('" onmouseover="alert(1)')
  })

  it('escapes a display name from the caller-supplied map', () => {
    expect(escapeForSlack('<@U123>', { users: { U123: '"><script>alert(1)</script>' } })).toBe(
      '<span class="user-mention">@"&gt;&lt;script&gt;alert(1)&lt;/script&gt;</span>'
    )
  })

  it('escapes a channel name from the caller-supplied map', () => {
    expect(escapeForSlack('<#C123>', { channels: { C123: '<b>general</b>' } })).toBe(
      '#&lt;b&gt;general&lt;/b&gt;'
    )
  })

  it('escapes a usergroup name from the caller-supplied map', () => {
    expect(escapeForSlack('<!subteam^S123>', { usergroups: { S123: '<b>eng</b>' } })).toBe(
      '&lt;b&gt;eng&lt;/b&gt;'
    )
  })

  it('does not double-encode an entity inside a label', () => {
    expect(escapeForSlack('<https://example.com|Ben &amp; Jerry>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Ben &amp; Jerry</a>'
    )
  })

  it('encodes a bare ampersand inside an href', () => {
    expect(escapeForSlack('<https://example.com/?a=1&b=2>')).toBe(
      '<a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https://example.com/?a=1&amp;b=2</a>'
    )
  })
})

describe('URL scheme allowlist', () => {
  it('does not render a javascript: sequence as a link', () => {
    expect(escapeForSlack('<javascript:alert(1)|click me>')).toBe(
      '&lt;javascript:alert(1)|click me&gt;'
    )
  })

  it('rejects a custom emoji whose URL uses an unsafe scheme', () => {
    expect(escapeForSlack(':evil:', { customEmoji: { evil: 'javascript:alert(1)' } })).toBe(
      ':evil:'
    )
  })

  it('rejects a custom emoji URL that would break out of the src attribute', () => {
    expect(
      escapeForSlack(':evil:', { customEmoji: { evil: 'http://e/x.png" onerror="alert(1)' } })
    ).toBe(':evil:')
  })

  it('renders a legitimate custom emoji URL', () => {
    expect(escapeForSlack(':ok:', { customEmoji: { ok: 'https://example.com/ok.png' } })).toBe(
      '<img alt="ok" src="https://example.com/ok.png" title=":ok:" class="slack_emoji" />'
    )
  })
})

describe('placeholder forgery', () => {
  it('strips the NUL characters used to park rendered control sequences', () => {
    expect(escapeForSlack('before\u00000\u0000after')).toBe('before0after')
  })

  it('cannot be tricked into substituting a real control sequence twice', () => {
    expect(escapeForSlack('\u00000\u0000 <@U123|dave>')).toBe(
      '0 <span class="user-mention">@dave</span>'
    )
  })
})
