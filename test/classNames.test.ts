import { describe, expect, it } from 'vitest'
import { defaultClassNames, escapeForSlack, escapeForSlackWithMarkdown } from '../src/index.js'

describe('class names', () => {
  it('exposes the defaults', () => {
    expect(defaultClassNames.bold).toBe('slack_bold')
    expect(defaultClassNames.userMention).toBe('user-mention')
  })

  it('overrides the markdown classes', () => {
    expect(
      escapeForSlackWithMarkdown('*bold* _italic_ ~struck~ `code`', {
        classNames: {
          bold: 'font-bold',
          italics: 'italic',
          strikethrough: 'line-through',
          code: 'font-mono',
        },
      })
    ).toBe(
      '<span class="font-bold">bold</span> <span class="italic">italic</span> <span class="line-through">struck</span> <span class="font-mono"><code>code</code></span>'
    )
  })

  it('overrides the block quote class for both variants', () => {
    expect(
      escapeForSlackWithMarkdown('&gt;&gt;&gt;quoted', { classNames: { block: 'quote' } })
    ).toBe('<div class="quote">quoted</div>')
    expect(escapeForSlackWithMarkdown('&gt;quoted', { classNames: { block: 'quote' } })).toBe(
      '<span class="quote">quoted</span>'
    )
  })

  it('overrides the mention class', () => {
    expect(escapeForSlack('<@U1|dave>', { classNames: { userMention: 'mention' } })).toBe(
      '<span class="mention">@dave</span>'
    )
  })

  it('overrides the custom emoji class', () => {
    expect(
      escapeForSlack(':ok:', {
        customEmoji: { ok: 'https://example.com/ok.png' },
        classNames: { emoji: 'inline-emoji' },
      })
    ).toBe('<img alt="ok" src="https://example.com/ok.png" title=":ok:" class="inline-emoji" />')
  })

  it('overrides the date class', () => {
    expect(
      escapeForSlack('<!date^1392734382^{date_num}|fallback>', { classNames: { date: 'ts' } })
    ).toBe('<time datetime="2014-02-18T14:39:42.000Z" class="ts">2014-02-18</time>')
  })

  it('leaves unspecified classes at their defaults', () => {
    expect(
      escapeForSlackWithMarkdown('*bold* _italic_', { classNames: { bold: 'font-bold' } })
    ).toBe('<span class="font-bold">bold</span> <span class="slack_italics">italic</span>')
  })

  it('escapes a class name that would break out of the attribute', () => {
    expect(
      escapeForSlackWithMarkdown('*bold*', { classNames: { bold: '"><script>alert(1)</script>' } })
    ).toBe('<span class="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">bold</span>')
  })
})
