/*
 * Renders Slack's date control sequence:
 *
 *   <!date^1392734382^Posted {date_num} {time}^https://example.com|Feb 18, 2014>
 *
 * Slack expects each client to format the timestamp in the reader's timezone.
 * A server-side renderer has no reader, so this formats in UTC unless a
 * `dateTimeZone` is given.
 */

const MILLISECONDS_PER_DAY = 86_400_000

const partsFor = (date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone, ...options }).formatToParts(date)

const partValue = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string =>
  parts.find((part) => part.type === type)?.value ?? ''

const ordinalSuffix = (day: number): string => {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return 'th'
  }
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

/** The calendar day of a timestamp in the given zone, as a `YYYY-MM-DD` string. */
const calendarDay = (date: Date, timeZone: string): string => {
  const parts = partsFor(date, timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return `${partValue(parts, 'year')}-${partValue(parts, 'month')}-${partValue(parts, 'day')}`
}

/** `today`, `yesterday` or `tomorrow` when the date is one of them. */
const relativeDay = (date: Date, timeZone: string, now: Date): string | undefined => {
  const target = calendarDay(date, timeZone)
  if (target === calendarDay(now, timeZone)) {
    return 'today'
  }
  if (target === calendarDay(new Date(now.getTime() - MILLISECONDS_PER_DAY), timeZone)) {
    return 'yesterday'
  }
  if (target === calendarDay(new Date(now.getTime() + MILLISECONDS_PER_DAY), timeZone)) {
    return 'tomorrow'
  }
  return undefined
}

export interface DateTokenOptions {
  timeZone: string
  /** Injectable for deterministic tests of the `_pretty` tokens. */
  now?: Date
}

const buildTokens = (date: Date, { timeZone, now }: DateTokenOptions): Record<string, string> => {
  const dateParts = partsFor(date, timeZone, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
  const shortParts = partsFor(date, timeZone, { year: 'numeric', month: 'short', day: 'numeric' })
  const timeParts = partsFor(date, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true })
  const timeSecsParts = partsFor(date, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const day = Number(partValue(dateParts, 'day'))
  const dayWithSuffix = `${day}${ordinalSuffix(day)}`
  const month = partValue(dateParts, 'month')
  const year = partValue(dateParts, 'year')
  const weekday = partValue(dateParts, 'weekday')

  // ICU separates the time from AM/PM with U+202F, which varies between Node
  // versions and is surprising in HTML output, so it is normalized to a space.
  const formatTime = (parts: Intl.DateTimeFormatPart[]): string =>
    parts
      .map((part) => part.value)
      .join('')
      .replace(/[\u00A0\u202F]/g, ' ')
      .trim()

  const dateNum = calendarDay(date, timeZone)
  const dateText = `${month} ${dayWithSuffix}, ${year}`
  const dateShort = `${partValue(shortParts, 'month')} ${partValue(shortParts, 'day')}, ${partValue(shortParts, 'year')}`
  const dateLong = `${weekday}, ${month} ${dayWithSuffix}, ${year}`

  const relative = relativeDay(date, timeZone, now ?? new Date())
  const pretty = (fallback: string): string => relative ?? fallback

  return {
    date_num: dateNum,
    date: dateText,
    date_short: dateShort,
    date_long: dateLong,
    date_pretty: pretty(dateText),
    date_short_pretty: pretty(dateShort),
    date_long_pretty: pretty(dateLong),
    time: formatTime(timeParts),
    time_secs: formatTime(timeSecsParts),
  }
}

const TOKEN_PATTERN = /\{(\w+)\}/g

/**
 * Substitutes `{date_num}`-style tokens. Returns `undefined` when the timestamp
 * cannot be formatted, so the caller can fall back to Slack's own text.
 */
export const formatSlackDate = (
  timestampSeconds: string,
  format: string,
  options: DateTokenOptions
): string | undefined => {
  const seconds = Number(timestampSeconds)
  if (!Number.isFinite(seconds)) {
    return undefined
  }
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  let tokens: Record<string, string>
  try {
    tokens = buildTokens(date, options)
  } catch {
    // An invalid `dateTimeZone` makes Intl throw a RangeError.
    return undefined
  }

  return format.replace(TOKEN_PATTERN, (match, token: string) => tokens[token] ?? match)
}

/** The machine-readable value for a `<time datetime="...">` attribute. */
export const toIsoTimestamp = (timestampSeconds: string): string | undefined => {
  const seconds = Number(timestampSeconds)
  if (!Number.isFinite(seconds)) {
    return undefined
  }
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
