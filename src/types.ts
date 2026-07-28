/** Maps a Slack ID to the display name it should be rendered as. */
export type NameMap = Record<string, string>

/**
 * Maps a custom emoji shortname to either an image URL or an
 * `alias:other_shortname` pointer, matching the shape returned by Slack's
 * `emoji.list` API.
 */
export type CustomEmojiMap = Record<string, string>

/** The CSS classes applied to each rendered element. */
export interface ClassNames {
  code: string
  bold: string
  italics: string
  strikethrough: string
  block: string
  emoji: string
  userMention: string
  date: string
}

export const defaultClassNames: ClassNames = {
  code: 'slack_code',
  bold: 'slack_bold',
  italics: 'slack_italics',
  strikethrough: 'slack_strikethrough',
  block: 'slack_block',
  emoji: 'slack_emoji',
  userMention: 'user-mention',
  date: 'slack_date',
}

export interface SlackEscapeOptions {
  /** From `users.list`, keyed by user ID: `{ U123: 'david' }`. */
  users?: NameMap
  /** From `conversations.list`, keyed by channel ID: `{ C123: 'general' }`. */
  channels?: NameMap
  /** From `usergroups.list`, keyed by subteam ID: `{ S123: 'eng' }`. */
  usergroups?: NameMap
  /** From `emoji.list`, keyed by shortname: `{ facepalm: 'https://...png' }`. */
  customEmoji?: CustomEmojiMap
  /** Render Slack's `mrkdwn` (bold, italics, code, quotes). Defaults to `false`. */
  markdown?: boolean
  /**
   * Encode `&`, `<` and `>` in the message body so raw HTML cannot reach the
   * output. Existing entities are preserved, so text that Slack already encoded
   * is unaffected. Defaults to `true`.
   *
   * Turning this off does not disable escaping of interpolated values such as
   * link URLs, labels and display names, which is always applied.
   */
  escapeHtml?: boolean
  /** Overrides for the CSS classes applied to rendered elements. */
  classNames?: Partial<ClassNames>
  /**
   * IANA timezone used to render `<!date^...>` sequences. Defaults to `'UTC'`,
   * since a server-side renderer cannot know the reader's timezone.
   */
  dateTimeZone?: string
}

export const resolveClassNames = (overrides: Partial<ClassNames> | undefined): ClassNames =>
  overrides ? { ...defaultClassNames, ...overrides } : defaultClassNames
