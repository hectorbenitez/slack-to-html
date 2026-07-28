import { tokenizeControlSequences } from './controlSequences.js'
import { expandEmoji } from './emoji.js'
import { escapeHtml } from './escape.js'
import { expandText } from './markdown.js'
import { buildSlackPatterns } from './patterns.js'
import { PlaceholderStore, stripPlaceholderCharacters } from './placeholders.js'
import type { SlackEscapeOptions } from './types.js'
import { resolveClassNames } from './types.js'

export type { ClassNames, CustomEmojiMap, NameMap, SlackEscapeOptions } from './types.js'
export { defaultClassNames } from './types.js'
export { emojiData, expandEmoji } from './emoji.js'
export { buildSlackPatterns }

/** Mirrors 1.x, which coerced any falsy input to an empty string. */
const normalizeInput = (text: string | null | undefined): string => (text ? `${text}` : '')

/**
 * Renders a Slack message as HTML.
 *
 * The passes run in a fixed order, because each one depends on the previous:
 * control sequences are rendered first (before escaping could destroy their
 * `<...>` delimiters) and parked as placeholders, then the remaining text is
 * escaped, formatted as markdown, and finally emoji-expanded.
 */
export const escapeForSlack = (
  text: string | null | undefined,
  options: SlackEscapeOptions = {}
): string => {
  const classNames = resolveClassNames(options.classNames)
  const placeholders = new PlaceholderStore()

  const source = stripPlaceholderCharacters(normalizeInput(text))
  const tokenized = tokenizeControlSequences(source, options, classNames, placeholders)
  const escaped = options.escapeHtml === false ? tokenized : escapeHtml(tokenized)
  const formatted = options.markdown ? expandText(escaped, classNames) : escaped
  const withEmoji = expandEmoji(formatted, {
    customEmoji: options.customEmoji ?? {},
    classNames,
  })

  return placeholders.restore(withEmoji)
}

/** {@link escapeForSlack} with Slack's `mrkdwn` formatting enabled. */
export const escapeForSlackWithMarkdown = (
  text: string | null | undefined,
  options: SlackEscapeOptions = {}
): string => escapeForSlack(text, { ...options, markdown: true })

/**
 * @deprecated Renamed to {@link buildSlackPatterns} in 2.0.0.
 */
export const buildSlackHawkDownRegExps = buildSlackPatterns
