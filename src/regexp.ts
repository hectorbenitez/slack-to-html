export type MatchGroups = Record<string, string | undefined>

export type GroupReplacer = (groups: MatchGroups, fullMatch: string) => string

const cache = new Map<string, RegExp>()

/**
 * Compiles a pattern once and reuses it. Every cached expression carries the `g`
 * flag so it can be searched from an arbitrary offset via {@link execFrom};
 * callers must therefore always set the offset rather than relying on
 * `lastIndex` carrying over between calls.
 */
export const cacheRegExp = (pattern: string, flags = ''): RegExp => {
  const key = `${flags}\u0000${pattern}`
  let compiled = cache.get(key)
  if (!compiled) {
    compiled = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`)
    cache.set(key, compiled)
  }
  return compiled
}

export const execFrom = (
  text: string,
  pattern: RegExp,
  position: number
): RegExpExecArray | null => {
  pattern.lastIndex = position > 0 ? position : 0
  return pattern.exec(text)
}

/** Applies each replacement over the whole string, in order. */
export const replaceEach = (
  text: string,
  replacements: readonly (readonly [RegExp, GroupReplacer])[]
): string =>
  replacements.reduce(
    (accumulated, [pattern, replacer]) =>
      accumulated.replace(pattern, (...args: unknown[]) => {
        const last = args[args.length - 1]
        const groups = (typeof last === 'object' && last !== null ? last : {}) as MatchGroups
        return replacer(groups, args[0] as string)
      }),
    text
  )
