const REGEXP_SPECIAL_CHARACTERS = /[-[\]{}()*+?.,\\^$|#\s]/g

export const escapeRegExp = (value: string): string =>
  value.replace(REGEXP_SPECIAL_CHARACTERS, '\\$&')

/*
 * Slack delivers message text with `&`, `<` and `>` already encoded, so escaping
 * has to be idempotent: an existing entity is left alone and only bare
 * characters are encoded. Escaping unconditionally would turn a real Slack
 * payload's `&gt;&gt;&gt;` block quote into `&amp;gt;...` and stop it rendering.
 */
const NAMED_OR_NUMERIC_ENTITY = '&(?:#\\d{1,7}|#[xX][\\da-fA-F]{1,6}|[a-zA-Z][a-zA-Z\\d]{1,31});'

const TEXT_UNSAFE = new RegExp(`${NAMED_OR_NUMERIC_ENTITY}|[&<>]`, 'g')
const ATTRIBUTE_UNSAFE = new RegExp(`${NAMED_OR_NUMERIC_ENTITY}|[&<>"']`, 'g')

const TEXT_REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const escapeOnce = (value: string, pattern: RegExp): string =>
  value.replace(pattern, (match) =>
    // A multi-character match is an entity that is already encoded.
    match.length > 1 ? match : (TEXT_REPLACEMENTS[match] ?? match)
  )

/** Encodes `&`, `<` and `>` for text content, preserving existing entities. */
export const escapeHtml = (value: string): string => escapeOnce(value, TEXT_UNSAFE)

/** Encodes `&`, `<`, `>`, `"` and `'` for use inside an HTML attribute. */
export const escapeAttribute = (value: string): string => escapeOnce(value, ATTRIBUTE_UNSAFE)

/** Replaces the outermost characters of a Slack control sequence with entities. */
export const escapeTags = (value: string): string =>
  `&lt;${escapeHtml(value.substring(1, value.length - 1))}&gt;`

const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

/**
 * Returns the URL when its scheme is safe to put in an `href` or `src`, and an
 * empty string otherwise. Relative URLs are allowed; anything that looks like a
 * scheme must be on the allowlist, which rejects `javascript:` and `data:`.
 */
export const sanitizeUrl = (url: string): string => {
  // Control characters and whitespace are stripped first, because browsers
  // ignore them when resolving a scheme ("java\nscript:" is "javascript:").
  // eslint-disable-next-line no-control-regex -- stripping them is the point
  const stripped = url.replace(/[\s\u0000-\u001F\u007F-\u009F]/g, '')
  const schemeMatch = /^[a-zA-Z][a-zA-Z\d+.-]*:/.exec(stripped)
  if (!schemeMatch) {
    return url
  }
  return SAFE_URL_SCHEMES.includes(schemeMatch[0].toLowerCase()) ? url : ''
}

/** Renders a URL for an `href`/`src` attribute, or an empty string if unsafe. */
export const escapeUrlAttribute = (url: string): string => escapeAttribute(sanitizeUrl(url))
