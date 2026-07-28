import { escapeRegExp } from './escape.js'
import { cacheRegExp } from './regexp.js'

// https://docs.slack.dev/messaging/formatting-message-text
export const userMentionRegExp = cacheRegExp(
  '<@(((?<userID>U[^|>]+)(\\|(?<userName>[^>]+))?)|(?<userNameWithoutID>[^>]+))>'
)
export const channelMentionRegExp = cacheRegExp(
  '<#(((?<channelID>C[^|>]+)(\\|(?<channelName>[^>]+))?)|(?<channelNameWithoutID>[^>]+))>'
)
export const linkRegExp = cacheRegExp('<(?<linkUrl>https?:[^|>]+)(\\|(?<linkHtml>[^>]+))?>')
export const mailToRegExp = cacheRegExp('<mailto:(?<mailTo>[^|>]+)(\\|(?<mailToName>[^>]+))?>')
export const telRegExp = cacheRegExp('<tel:(?<tel>[^|>]+)(\\|(?<telName>[^>]+))?>')
export const subteamCommandRegExp = cacheRegExp(
  '<!subteam\\^(?<subteamID>S[^|>]+)(\\|(?<subteamName>[^>]+))?>'
)
// <!date^1392734382^Posted {date_num} {time}^https://example.com|Feb 18, 2014>
export const dateCommandRegExp = cacheRegExp(
  '<!date\\^(?<dateTimestamp>-?\\d+)\\^(?<dateFormat>[^^|>]*)(\\^(?<dateLink>[^|>]*))?(\\|(?<dateFallback>[^>]*))?>'
)
export const commandRegExp = cacheRegExp('<!(?<commandLiteral>[^|>]+)(\\|(?<commandName>[^>]+))?>')

export const whitespaceRegExp = cacheRegExp('\\s', 's')

export const knownCommands = ['here', 'channel', 'group', 'everyone']

export interface DelimiterOptions {
  prefixPattern?: string
  spacePadded?: boolean
  escapeDelimiter?: boolean
}

export const buildOpeningDelimiterRegExp = (
  delimiter: string,
  { prefixPattern = '', spacePadded = false, escapeDelimiter = true }: DelimiterOptions = {}
): RegExp => {
  const escapedDelimiter = escapeDelimiter ? escapeRegExp(delimiter) : delimiter
  const openingWhitespace = spacePadded ? '(?<openingCapturedWhitespace>^|\\s)' : ''
  return cacheRegExp(`${openingWhitespace}${prefixPattern}${escapedDelimiter}`, 's')
}

// A negative lookahead cannot be used to capture the last consecutive delimiter,
// because delimiters can be more than one character long.
export const buildClosingDelimiterRegExp = (
  delimiter: string,
  { spacePadded = false, escapeDelimiter = true }: DelimiterOptions = {}
): RegExp => {
  const escapedDelimiter = escapeDelimiter ? escapeRegExp(delimiter) : delimiter
  const closingWhitespace = spacePadded ? '(?<closingCapturedWhitespace>\\s|$)' : ''
  return cacheRegExp(`${escapedDelimiter}${closingWhitespace}`, 's')
}

/** The expressions this library matches against, exposed for debugging. */
export const buildSlackPatterns = (): Record<string, RegExp> => ({
  userMentionRegExp,
  channelMentionRegExp,
  linkRegExp,
  mailToRegExp,
  telRegExp,
  subteamCommandRegExp,
  boldOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('*'),
  boldClosingDelimiterRegExp: buildClosingDelimiterRegExp('*'),
  italicsOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('_', { spacePadded: true }),
  italicsClosingDelimiterRegExp: buildClosingDelimiterRegExp('_', { spacePadded: true }),
  strikethroughOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('~'),
  strikethroughClosingDelimiterRegExp: buildClosingDelimiterRegExp('~'),
  blockDivOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('&gt;&gt;&gt;'),
  blockDivClosingDelimiterRegExp: buildClosingDelimiterRegExp('$', { escapeDelimiter: false }),
  blockSpanOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('&gt;'),
  blockSpanClosingDelimiterRegExp: buildClosingDelimiterRegExp('\\n|$', {
    escapeDelimiter: false,
  }),
})
