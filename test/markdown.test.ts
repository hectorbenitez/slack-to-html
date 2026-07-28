import { describe, expect, it } from 'vitest'
import { escapeForSlackWithMarkdown } from '../src/index.js'

describe('markdown', () => {
  describe('multiline code', () => {
    it('renders an element', () => {
      expect(escapeForSlackWithMarkdown('```a code block```')).toBe(
        '<div class="slack_code"><code>a code block</code></div>'
      )
    })

    it('converts newlines', () => {
      expect(escapeForSlackWithMarkdown('```a code block\nwith newlines```')).toBe(
        '<div class="slack_code"><code>a code block<br>with newlines</code></div>'
      )
    })

    it('greedily captures backticks', () => {
      expect(escapeForSlackWithMarkdown('````a code block with backticks````')).toBe(
        '<div class="slack_code"><code>`a code block with backticks`</code></div>'
      )
    })

    it('does not capture the whitespace between two blocks', () => {
      expect(escapeForSlackWithMarkdown('```one``` ```two```')).toBe(
        '<div class="slack_code"><code>one</code></div> <div class="slack_code"><code>two</code></div>'
      )
    })

    it('does not apply markdown inside a code block', () => {
      expect(escapeForSlackWithMarkdown('```a block with *asterisks*```')).toBe(
        '<div class="slack_code"><code>a block with *asterisks*</code></div>'
      )
    })

    it('does not affect markdown after a code block', () => {
      expect(escapeForSlackWithMarkdown('```a block``` with *bold* after it')).toBe(
        '<div class="slack_code"><code>a block</code></div> with <span class="slack_bold">bold</span> after it'
      )
    })
  })

  describe('inline code', () => {
    it('renders an element', () => {
      expect(escapeForSlackWithMarkdown('`inline code`')).toBe(
        '<span class="slack_code"><code>inline code</code></span>'
      )
    })
  })

  describe('bold', () => {
    it('renders an element', () => {
      expect(escapeForSlackWithMarkdown('this is *bold*')).toBe(
        'this is <span class="slack_bold">bold</span>'
      )
    })

    it('captures as much as possible', () => {
      expect(escapeForSlackWithMarkdown('this is *bold*with*more*asterisks*')).toBe(
        'this is <span class="slack_bold">bold*with*more*asterisks</span>'
      )
    })
  })

  describe('italics', () => {
    it('renders an element', () => {
      expect(escapeForSlackWithMarkdown('this is _italic_')).toBe(
        'this is <span class="slack_italics">italic</span>'
      )
    })

    it('leaves snake_case words alone', () => {
      expect(escapeForSlackWithMarkdown('snake_case_word')).toBe('snake_case_word')
    })
  })

  describe('strikethrough', () => {
    it('renders an element', () => {
      expect(escapeForSlackWithMarkdown('this is ~struck~')).toBe(
        'this is <span class="slack_strikethrough">struck</span>'
      )
    })
  })

  describe('block quotes', () => {
    it('is left alone when the delimiter follows non-whitespace content', () => {
      expect(escapeForSlackWithMarkdown('not whitespace &gt;&gt;&gt;a block quote')).toBe(
        'not whitespace &gt;&gt;&gt;a block quote'
      )
    })

    it('renders an element', () => {
      expect(escapeForSlackWithMarkdown('&gt;&gt;&gt;a block quote')).toBe(
        '<div class="slack_block">a block quote</div>'
      )
    })

    it('replaces newlines', () => {
      expect(escapeForSlackWithMarkdown('&gt;&gt;&gt;a block quote\nwith newlines')).toBe(
        '<div class="slack_block">a block quote<br>with newlines</div>'
      )
    })
  })

  describe('inline quotes', () => {
    it('is left alone when the delimiter follows non-whitespace content', () => {
      expect(escapeForSlackWithMarkdown('not whitespace &gt;a quote')).toBe(
        'not whitespace &gt;a quote'
      )
    })

    it('renders an element when the delimiter begins the line', () => {
      expect(escapeForSlackWithMarkdown('&gt;a quote')).toBe(
        '<span class="slack_block">a quote</span>'
      )
    })

    it('renders an element when the delimiter is preceded only by whitespace', () => {
      expect(escapeForSlackWithMarkdown('  \t   &gt;a quote')).toBe(
        '<span class="slack_block">a quote</span>'
      )
    })
  })

  describe('combinations', () => {
    it('renders every delimiter in one message', () => {
      expect(escapeForSlackWithMarkdown('*bold* _italic_ ~struck~ `code`')).toBe(
        '<span class="slack_bold">bold</span> <span class="slack_italics">italic</span> <span class="slack_strikethrough">struck</span> <span class="slack_code"><code>code</code></span>'
      )
    })

    it('renders markdown alongside control sequences and emoji', () => {
      expect(
        escapeForSlackWithMarkdown('<@U123> said *hello* :wave:', { users: { U123: 'someone' } })
      ).toBe(
        '<span class="user-mention">@someone</span> said <span class="slack_bold">hello</span> <span title=":wave:">&#x1F44B;</span>'
      )
    })
  })

  describe('unmatched delimiters', () => {
    it('leaves a lone bold delimiter alone', () => {
      expect(escapeForSlackWithMarkdown('unmatched *bold')).toBe('unmatched *bold')
    })

    it('leaves a lone code delimiter alone', () => {
      expect(escapeForSlackWithMarkdown('unmatched `code')).toBe('unmatched `code')
    })
  })
})
