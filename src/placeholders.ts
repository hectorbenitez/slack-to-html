/*
 * Control sequences are rendered before the text around them is escaped, so
 * their HTML has to be hidden from the escaping, markdown and emoji passes. Each
 * one is swapped for a placeholder and restored at the very end.
 *
 * Placeholders are delimited by NUL, which is stripped from the input first, so
 * a message cannot forge one. NUL also survives the later passes untouched: it
 * is not a markdown delimiter, and an emoji lookup containing it always misses,
 * which leaves the match unchanged.
 */

const NUL = '\u0000'
/* eslint-disable no-control-regex -- matching NUL is the point of these patterns */
const PLACEHOLDER_PATTERN = /\u0000(\d+)\u0000/g
const FORGEABLE_CHARACTERS = /\u0000/g
/* eslint-enable no-control-regex */

export const stripPlaceholderCharacters = (text: string): string =>
  text.replace(FORGEABLE_CHARACTERS, '')

export class PlaceholderStore {
  private readonly rendered: string[] = []

  /** Stores rendered HTML and returns the placeholder that stands in for it. */
  add(html: string): string {
    this.rendered.push(html)
    return `${NUL}${this.rendered.length - 1}${NUL}`
  }

  /** Substitutes every placeholder back into the text. */
  restore(text: string): string {
    if (this.rendered.length === 0) {
      return text
    }
    return text.replace(PLACEHOLDER_PATTERN, (match, index: string) => {
      return this.rendered[Number(index)] ?? match
    })
  }
}
