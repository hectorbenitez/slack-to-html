import { emojiData } from './emojiData.js'
import { escapeAttribute, escapeUrlAttribute } from './escape.js'
import type { ClassNames, CustomEmojiMap } from './types.js'
import { resolveClassNames } from './types.js'

export { emojiData }

/*
 * Shortnames exclude the characters that appear in URLs, so a link such as
 * `https://example.com/a#:~:text=hi` is no longer partially consumed as an
 * emoji (issue #1). Standard shortnames only use letters, digits, `_`, `-` and
 * `+`; the wider set here keeps working for custom emoji with other characters.
 */
const shortNameRegExp = /:([^\s:/\\<>&?#]+?):/g
const aliasRegExp = /^alias:(\S+)$/
const httpUrlRegExp = /^https?:\/\/\S+$/

/** Follows `alias:` chains until an image URL or code point sequence is reached. */
const resolve = (
  shortName: string,
  allEmoji: Readonly<Record<string, string>>
): string | undefined => {
  const seen = new Set<string>()
  let key = shortName
  let value = allEmoji[key]
  while (value) {
    const alias = aliasRegExp.exec(value)
    if (!alias?.[1] || seen.has(key)) {
      break
    }
    seen.add(key)
    key = alias[1]
    value = allEmoji[key]
  }
  return value
}

export interface ExpandEmojiOptions {
  customEmoji?: CustomEmojiMap
  classNames?: Partial<ClassNames>
}

/**
 * Replaces `:shortname:` with an image tag or the matching Unicode characters.
 * An unknown shortname is left exactly as it was written (issue #4).
 */
export const expandEmoji = (text: string, options: ExpandEmojiOptions = {}): string => {
  const customEmoji = options.customEmoji ?? {}
  const classNames = resolveClassNames(options.classNames)
  const allEmoji: Readonly<Record<string, string>> =
    Object.keys(customEmoji).length > 0 ? { ...emojiData, ...customEmoji } : emojiData

  return text.replace(shortNameRegExp, (match, shortName: string) => {
    const value = resolve(shortName, allEmoji)
    if (!value) {
      return match
    }

    const title = escapeAttribute(`:${shortName}:`)

    if (httpUrlRegExp.test(value)) {
      const source = escapeUrlAttribute(value)
      if (!source) {
        return match
      }
      return `<img alt="${escapeAttribute(shortName)}" src="${source}" title="${title}" class="${escapeAttribute(
        classNames.emoji
      )}" />`
    }

    if (!/^[\dA-Fa-f]+(?:-[\dA-Fa-f]+)*$/.test(value)) {
      // Not a code point sequence, so it cannot be rendered as characters.
      return match
    }

    const codePoints = value
      .split('-')
      .map((codePoint) => `&#x${codePoint};`)
      .join('')
    return `<span title="${title}">${codePoints}</span>`
  })
}
