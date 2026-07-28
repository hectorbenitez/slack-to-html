import { afterEach, describe, expect, it, vi } from 'vitest'
import { escapeForSlack } from '../src/index.js'

// 2014-02-18T14:39:42Z
const TIMESTAMP = '1392734382'
const ISO = '2014-02-18T14:39:42.000Z'

const time = (body: string): string => `<time datetime="${ISO}" class="slack_date">${body}</time>`

afterEach(() => {
  vi.useRealTimers()
})

describe('dates', () => {
  describe('format tokens', () => {
    it.each([
      ['{date_num}', '2014-02-18'],
      ['{date}', 'February 18th, 2014'],
      ['{date_short}', 'Feb 18, 2014'],
      ['{date_long}', 'Tuesday, February 18th, 2014'],
      ['{time}', '2:39 PM'],
      ['{time_secs}', '2:39:42 PM'],
    ])('renders %s', (token, expected) => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^${token}|fallback>`)).toBe(time(expected))
    })

    it('renders surrounding literal text and several tokens', () => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^Posted {date_num} at {time}|fallback>`)).toBe(
        time('Posted 2014-02-18 at 2:39 PM')
      )
    })

    it('leaves an unknown token alone', () => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^{not_a_token}|fallback>`)).toBe(
        time('{not_a_token}')
      )
    })
  })

  describe('ordinal suffixes', () => {
    it.each([
      ['1388577600', 'January 1st, 2014'],
      ['1388750400', 'January 3rd, 2014'],
      ['1389441600', 'January 11th, 2014'],
      ['1389614400', 'January 13th, 2014'],
      ['1390392000', 'January 22nd, 2014'],
      ['1390478400', 'January 23rd, 2014'],
      ['1391169600', 'January 31st, 2014'],
    ])('renders %s as %s', (timestamp, expected) => {
      expect(escapeForSlack(`<!date^${timestamp}^{date}|fallback>`)).toContain(`>${expected}<`)
    })
  })

  describe('relative tokens', () => {
    it('renders today', () => {
      vi.setSystemTime(new Date(ISO))
      expect(escapeForSlack(`<!date^${TIMESTAMP}^{date_pretty}|fallback>`)).toBe(time('today'))
    })

    it('renders yesterday', () => {
      vi.setSystemTime(new Date('2014-02-19T10:00:00Z'))
      expect(escapeForSlack(`<!date^${TIMESTAMP}^{date_pretty}|fallback>`)).toBe(time('yesterday'))
    })

    it('renders tomorrow', () => {
      vi.setSystemTime(new Date('2014-02-17T10:00:00Z'))
      expect(escapeForSlack(`<!date^${TIMESTAMP}^{date_short_pretty}|fallback>`)).toBe(
        time('tomorrow')
      )
    })

    it('falls back to the absolute date when it is not nearby', () => {
      vi.setSystemTime(new Date('2020-01-01T00:00:00Z'))
      expect(escapeForSlack(`<!date^${TIMESTAMP}^{date_long_pretty}|fallback>`)).toBe(
        time('Tuesday, February 18th, 2014')
      )
    })
  })

  describe('time zones', () => {
    it('formats in UTC by default', () => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^{time}|fallback>`)).toBe(time('2:39 PM'))
    })

    it('honours the configured zone', () => {
      expect(
        escapeForSlack(`<!date^${TIMESTAMP}^{time}|fallback>`, {
          dateTimeZone: 'America/Mexico_City',
        })
      ).toBe(time('8:39 AM'))
    })

    it('can shift the calendar day', () => {
      expect(
        escapeForSlack(`<!date^${TIMESTAMP}^{date_num} {time}|fallback>`, {
          dateTimeZone: 'Asia/Tokyo',
        })
      ).toBe(time('2014-02-18 11:39 PM'))
    })

    it('falls back to Slack’s own text when the zone is invalid', () => {
      expect(
        escapeForSlack(`<!date^${TIMESTAMP}^{date_num}|Feb 18, 2014>`, {
          dateTimeZone: 'Not/AZone',
        })
      ).toBe(time('Feb 18, 2014'))
    })
  })

  describe('links', () => {
    it('wraps the formatted date in an anchor', () => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^{date_num}^https://example.com/x|fallback>`)).toBe(
        time(
          '<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">2014-02-18</a>'
        )
      )
    })

    it('drops a link with an unsafe scheme', () => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^{date_num}^javascript:alert(1)|fallback>`)).toBe(
        time('2014-02-18')
      )
    })
  })

  describe('fallbacks', () => {
    it('uses Slack’s text when the format string is empty', () => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^|Feb 18, 2014>`)).toBe(time('Feb 18, 2014'))
    })

    it('escapes the fallback text', () => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^|a & b>`)).toBe(time('a &amp; b'))
    })

    it('renders plain text when the timestamp cannot be represented', () => {
      expect(escapeForSlack('<!date^99999999999999999^{date}|too big>')).toBe('too big')
    })

    it('escapes the sequence when there is nothing to render', () => {
      expect(escapeForSlack(`<!date^${TIMESTAMP}^>`)).toBe(`&lt;!date^${TIMESTAMP}^&gt;`)
    })

    it('escapes a malformed sequence', () => {
      expect(escapeForSlack('<!date^nonsense^{date}|the fallback>')).toBe(
        '&lt;!date^nonsense^{date}|the fallback&gt;'
      )
    })
  })

  it('renders alongside other control sequences', () => {
    expect(
      escapeForSlack(`sent <!date^${TIMESTAMP}^{date_short}|Feb 18, 2014> by <@U1|dave>`)
    ).toBe(`sent ${time('Feb 18, 2014')} by <span class="user-mention">@dave</span>`)
  })
})
