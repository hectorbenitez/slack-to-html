import { escapeAttribute } from './escape.js'
import {
  buildClosingDelimiterRegExp,
  buildOpeningDelimiterRegExp,
  whitespaceRegExp,
} from './patterns.js'
import { execFrom } from './regexp.js'
import type { ClassNames } from './types.js'

const CLOSING_DIV = '</div>'
const CLOSING_SPAN = '</span>'
const CODE_OPENING = '<code>'
const CODE_CLOSING = '</code>'
const LINE_BREAK_TAG = '<br>'

/** A `[start, end)` region of the text that markdown may still be applied to. */
type TagWindow = [number, number]

interface ExpandedText {
  text: string
  windows: TagWindow[]
}

interface ReplaceOptions {
  /** Split the window in two around the match, so nested passes skip the match. */
  partitionWindowOnMatch?: boolean
  /** Require the delimiters to be surrounded by whitespace or string boundaries. */
  spacePadded?: boolean
  /** Close on this pattern instead of a second occurrence of the delimiter. */
  endingPattern?: string
  replaceNewlines?: boolean
  prefixPattern?: string
  maxReplacements?: number
}

/** A region of the text to rewrite, in the coordinates of the text read. */
interface Replacement {
  start: number
  end: number
  text: string
}

const applyReplacements = (text: string, replacements: Replacement[]): string => {
  if (replacements.length === 0) {
    return text
  }
  const parts: string[] = []
  let position = 0
  for (const replacement of replacements) {
    parts.push(text.slice(position, replacement.start), replacement.text)
    position = replacement.end
  }
  parts.push(text.slice(position))
  return parts.join('')
}

/**
 * Moves window bounds into the coordinates of the replaced text. A bound shifts
 * by every replacement beginning before it, which holds a window truncated at a
 * replacement's start in place while moving one that resumes after it.
 *
 * Replacements and windows are both in increasing order and windows never
 * overlap, so the bounds are visited in increasing order and the replacements can
 * be consumed in a single pass.
 */
const translateWindows = (windows: TagWindow[], replacements: Replacement[]): void => {
  if (replacements.length === 0) {
    return
  }
  let replacementIndex = 0
  let shift = 0
  for (const tagWindow of windows) {
    for (const bound of [0, 1] as const) {
      let pending = replacements[replacementIndex]
      while (pending && pending.start < tagWindow[bound]) {
        shift += pending.text.length - (pending.end - pending.start)
        replacementIndex += 1
        pending = replacements[replacementIndex]
      }
      tagWindow[bound] += shift
    }
  }
}

const replaceInWindows = (
  text: string,
  delimiterLiteral: string,
  replacementOpeningLiteral: string,
  replacementClosingLiteral: string,
  closedTagWindows: TagWindow[],
  options: ReplaceOptions = {}
): ExpandedText => {
  const { partitionWindowOnMatch, spacePadded, replaceNewlines, prefixPattern } = options
  const asymmetric = options.endingPattern
  let maxReplacements = options.maxReplacements

  // An opening match always contains the delimiter literally, so a text without
  // it cannot produce one. Worth checking up front: an earlier pass may have
  // split the text into very many windows, each of which would otherwise be
  // scanned separately below.
  if (!text.includes(delimiterLiteral)) {
    return { text, windows: closedTagWindows }
  }

  const openingDelimiterRegExp = buildOpeningDelimiterRegExp(delimiterLiteral, {
    spacePadded,
    prefixPattern,
  })
  const closingDelimiterRegExp = asymmetric
    ? buildClosingDelimiterRegExp(asymmetric, { escapeDelimiter: false })
    : buildClosingDelimiterRegExp(delimiterLiteral, { spacePadded })

  /*
   * The text is read as it was received and rewritten once at the end, rather
   * than rebuilt around every delimiter pair. This is safe because scanning
   * always resumes at or after the end of the pair just matched, so no region
   * still to be read is ever rewritten beforehand. Rebuilding in place cost time
   * proportional to the length of the whole text for every pair, which on a text
   * with many pairs outweighed everything else the pass does.
   *
   * Every position therefore stays in the coordinates of the text received,
   * including the window bounds, which are moved into the coordinates of the
   * result once the pass is finished. Keeping one coordinate system is also what
   * fixes overlapping delimiter matches: the bounds used to be advanced by a
   * predicted length change that was wrong when the opening and closing matches
   * shared a character, leaving them out of step with the text for later passes.
   */
  const replacements: Replacement[] = []
  const finish = (): ExpandedText => {
    translateWindows(closedTagWindows, replacements)
    return { text: applyReplacements(text, replacements), windows: closedTagWindows }
  }

  let tagWindowIndex = 0
  let tagWindowOffset = 0

  /*
   * A scan is not bounded by the window it was started for, so it can run to the
   * end of the text and find a match belonging to a later window. Remembering the
   * result lets the following windows reuse it instead of repeating the same scan,
   * which is what made a text split into many windows cost quadratic time.
   *
   * Reuse is sound because `lastScan.match` is the first match at or after
   * `lastScan.from`: for any position in `[lastScan.from, lastScan.match.index]`
   * the answer is the same match, and a null result means there is no match after
   * that position at all.
   */
  let lastScan: { from: number; match: RegExpExecArray | null } | null = null

  const findOpeningDelimiter = (from: number): RegExpExecArray | null => {
    if (lastScan && lastScan.from <= from && (!lastScan.match || lastScan.match.index >= from)) {
      return lastScan.match
    }
    const match = execFrom(text, openingDelimiterRegExp, from)
    lastScan = { from, match }
    return match
  }

  for (;;) {
    // A limit of exactly 0 does not halt the loop, only a negative one does, so
    // `maxReplacements: n` permits n + 1 replacements. Preserved from 1.x.
    const exhausted = maxReplacements !== undefined && maxReplacements < 0
    if (tagWindowIndex >= closedTagWindows.length || exhausted) {
      return finish()
    }

    const currentClosedTagWindow = closedTagWindows[tagWindowIndex] as TagWindow
    const tagWindowStartIndex = currentClosedTagWindow[0]
    const tagWindowEndIndex = currentClosedTagWindow[1]

    if (
      tagWindowStartIndex >= tagWindowEndIndex ||
      tagWindowStartIndex + tagWindowOffset > tagWindowEndIndex
    ) {
      tagWindowIndex += 1
      tagWindowOffset = 0
      continue
    }

    const openingMatch = findOpeningDelimiter(tagWindowStartIndex + tagWindowOffset)

    if (openingMatch && openingMatch.index < tagWindowEndIndex) {
      const closingDelimiterLength = asymmetric ? 0 : delimiterLiteral.length
      // Allow matching the end of the string if on the last window.
      const lastWindow =
        tagWindowIndex === closedTagWindows.length - 1 && tagWindowEndIndex === text.length
      const closingMatchMaxIndex =
        (lastWindow ? tagWindowEndIndex + 1 : tagWindowEndIndex) - closingDelimiterLength + 1

      // Look ahead at the next index to greedily capture as much inside the
      // delimiters as possible.
      let closingMatch = execFrom(
        text,
        closingDelimiterRegExp,
        openingMatch.index + delimiterLiteral.length
      )
      let nextClosingMatch =
        closingMatch && execFrom(text, closingDelimiterRegExp, closingMatch.index + 1)
      while (closingMatch && nextClosingMatch) {
        // If the next match is still in the window and there is no whitespace in
        // between the two, use the later one.
        const nextWhitespace = execFrom(
          text,
          whitespaceRegExp,
          closingMatch.index + delimiterLiteral.length
        )
        const crossedWhitespace = nextWhitespace && nextWhitespace.index < closingMatchMaxIndex
        if (nextClosingMatch.index >= closingMatchMaxIndex || crossedWhitespace) {
          break
        }
        closingMatch = nextClosingMatch
        nextClosingMatch = execFrom(text, closingDelimiterRegExp, closingMatch.index + 1)
      }

      if (closingMatch && closingMatch.index < closingMatchMaxIndex) {
        const afterDelimitersIndex = closingMatch.index + closingMatch[0].length

        const openingWhitespace = spacePadded
          ? (openingMatch.groups?.openingCapturedWhitespace ?? '')
          : ''
        const closingWhitespace = spacePadded
          ? (closingMatch.groups?.closingCapturedWhitespace ?? '')
          : ''
        const openingReplacementString = `${openingWhitespace}${replacementOpeningLiteral}`
        const closingReplacementString = `${replacementClosingLiteral}${closingWhitespace}${
          asymmetric ? closingMatch[0] : ''
        }`

        const textBetweenDelimiters = text.slice(
          openingMatch.index + openingMatch[0].length,
          closingMatch.index
        )
        const replacedTextBetweenDelimiters = replaceNewlines
          ? textBetweenDelimiters.replaceAll('\n', LINE_BREAK_TAG)
          : textBetweenDelimiters

        const replacedDelimiterText = `${openingReplacementString}${replacedTextBetweenDelimiters}${closingReplacementString}`

        const nextWindowIndex = partitionWindowOnMatch ? tagWindowIndex + 1 : tagWindowIndex

        if (partitionWindowOnMatch) {
          // Split the current window into two around the delimiter pair.
          currentClosedTagWindow[1] = openingMatch.index
          closedTagWindows.splice(nextWindowIndex, 0, [
            closingMatch.index + closingDelimiterLength,
            tagWindowEndIndex,
          ])
        }
        if (maxReplacements !== undefined) {
          maxReplacements -= 1
        }

        replacements.push({
          start: openingMatch.index,
          end: afterDelimitersIndex,
          text: replacedDelimiterText,
        })
        tagWindowIndex = nextWindowIndex
        tagWindowOffset = partitionWindowOnMatch
          ? 0
          : afterDelimitersIndex + 1 - tagWindowStartIndex
        continue
      }
    }

    tagWindowIndex += 1
    tagWindowOffset = 0
  }
}

/** Applies Slack's `mrkdwn` delimiters, outermost first. */
export const expandText = (text: string, classNames: ClassNames): string => {
  const openingTag = (tag: 'div' | 'span', className: string): string =>
    `<${tag} class="${escapeAttribute(className)}">`

  let expanded: ExpandedText = { text, windows: [[0, text.length]] }

  expanded = replaceInWindows(
    expanded.text,
    '```',
    openingTag('div', classNames.code) + CODE_OPENING,
    CODE_CLOSING + CLOSING_DIV,
    expanded.windows,
    { partitionWindowOnMatch: true, replaceNewlines: true }
  )
  expanded = replaceInWindows(
    expanded.text,
    '`',
    openingTag('span', classNames.code) + CODE_OPENING,
    CODE_CLOSING + CLOSING_SPAN,
    expanded.windows,
    { partitionWindowOnMatch: true }
  )
  expanded = replaceInWindows(
    expanded.text,
    '*',
    openingTag('span', classNames.bold),
    CLOSING_SPAN,
    expanded.windows,
    { maxReplacements: 100 }
  )
  expanded = replaceInWindows(
    expanded.text,
    '~',
    openingTag('span', classNames.strikethrough),
    CLOSING_SPAN,
    expanded.windows,
    { maxReplacements: 100 }
  )
  expanded = replaceInWindows(
    expanded.text,
    '_',
    openingTag('span', classNames.italics),
    CLOSING_SPAN,
    expanded.windows,
    { spacePadded: true, maxReplacements: 100 }
  )
  expanded = replaceInWindows(
    expanded.text,
    '&gt;&gt;&gt;',
    openingTag('div', classNames.block),
    CLOSING_DIV,
    expanded.windows,
    { prefixPattern: '^\\s*', endingPattern: '$', replaceNewlines: true, maxReplacements: 100 }
  )
  expanded = replaceInWindows(
    expanded.text,
    '&gt;',
    openingTag('span', classNames.block),
    CLOSING_SPAN,
    expanded.windows,
    { prefixPattern: '^\\s*', endingPattern: '\\n|$', maxReplacements: 100 }
  )

  return expanded.text
}
