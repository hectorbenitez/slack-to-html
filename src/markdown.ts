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

const incrementWindows = (windows: TagWindow[], offset: number): void => {
  windows.forEach((tagWindow) => {
    tagWindow[0] += offset
    tagWindow[1] += offset
  })
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

  const openingDelimiterRegExp = buildOpeningDelimiterRegExp(delimiterLiteral, {
    spacePadded,
    prefixPattern,
  })
  const closingDelimiterRegExp = asymmetric
    ? buildClosingDelimiterRegExp(asymmetric, { escapeDelimiter: false })
    : buildClosingDelimiterRegExp(delimiterLiteral, { spacePadded })

  let currentText = text
  let tagWindowIndex = 0
  let tagWindowOffset = 0

  for (;;) {
    // A limit of exactly 0 does not halt the loop, only a negative one does, so
    // `maxReplacements: n` permits n + 1 replacements. Preserved from 1.x.
    const exhausted = maxReplacements !== undefined && maxReplacements < 0
    if (tagWindowIndex >= closedTagWindows.length || exhausted) {
      return { text: currentText, windows: closedTagWindows }
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

    const openingMatch = execFrom(
      currentText,
      openingDelimiterRegExp,
      tagWindowStartIndex + tagWindowOffset
    )

    if (openingMatch && openingMatch.index < tagWindowEndIndex) {
      const closingDelimiterLength = asymmetric ? 0 : delimiterLiteral.length
      // Allow matching the end of the string if on the last window.
      const lastWindow =
        tagWindowIndex === closedTagWindows.length - 1 && tagWindowEndIndex === currentText.length
      const closingMatchMaxIndex =
        (lastWindow ? tagWindowEndIndex + 1 : tagWindowEndIndex) - closingDelimiterLength + 1

      // Look ahead at the next index to greedily capture as much inside the
      // delimiters as possible.
      let closingMatch = execFrom(
        currentText,
        closingDelimiterRegExp,
        openingMatch.index + delimiterLiteral.length
      )
      let nextClosingMatch =
        closingMatch && execFrom(currentText, closingDelimiterRegExp, closingMatch.index + 1)
      while (closingMatch && nextClosingMatch) {
        // If the next match is still in the window and there is no whitespace in
        // between the two, use the later one.
        const nextWhitespace = execFrom(
          currentText,
          whitespaceRegExp,
          closingMatch.index + delimiterLiteral.length
        )
        const crossedWhitespace = nextWhitespace && nextWhitespace.index < closingMatchMaxIndex
        if (nextClosingMatch.index >= closingMatchMaxIndex || crossedWhitespace) {
          break
        }
        closingMatch = nextClosingMatch
        nextClosingMatch = execFrom(currentText, closingDelimiterRegExp, closingMatch.index + 1)
      }

      if (closingMatch && closingMatch.index < closingMatchMaxIndex) {
        const afterDelimitersIndex = closingMatch.index + closingMatch[0].length
        const textBeforeDelimiter = currentText.slice(0, openingMatch.index)
        const textAfterDelimiter = currentText.slice(afterDelimitersIndex)

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

        const textBetweenDelimiters = currentText.slice(
          openingMatch.index + openingMatch[0].length,
          closingMatch.index
        )
        const replacedTextBetweenDelimiters = replaceNewlines
          ? textBetweenDelimiters.replaceAll('\n', LINE_BREAK_TAG)
          : textBetweenDelimiters

        const replacedDelimiterText = `${openingReplacementString}${replacedTextBetweenDelimiters}${closingReplacementString}`

        const delimiterReplacementLength = delimiterLiteral.length + closingDelimiterLength
        const windowOffset =
          replacementOpeningLiteral.length +
          replacementClosingLiteral.length -
          delimiterReplacementLength +
          replacedTextBetweenDelimiters.length -
          textBetweenDelimiters.length
        const newUpperWindowLimit = tagWindowEndIndex + windowOffset

        const nextWindowIndex = partitionWindowOnMatch ? tagWindowIndex + 1 : tagWindowIndex
        const nextTagWindowOffset = partitionWindowOnMatch
          ? 0
          : afterDelimitersIndex + windowOffset - tagWindowStartIndex + 1

        if (partitionWindowOnMatch) {
          // Split the current window into two around the delimiter pair.
          currentClosedTagWindow[1] = openingMatch.index
          closedTagWindows.splice(nextWindowIndex, 0, [
            closingMatch.index + closingDelimiterLength + windowOffset,
            newUpperWindowLimit,
          ])
        } else {
          currentClosedTagWindow[1] = newUpperWindowLimit
        }
        incrementWindows(closedTagWindows.slice(nextWindowIndex + 1), windowOffset)
        if (maxReplacements !== undefined) {
          maxReplacements -= 1
        }

        currentText = `${textBeforeDelimiter}${replacedDelimiterText}${textAfterDelimiter}`
        tagWindowIndex = nextWindowIndex
        tagWindowOffset = nextTagWindowOffset
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
