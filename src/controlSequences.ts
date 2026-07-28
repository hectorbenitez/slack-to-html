import { formatSlackDate, toIsoTimestamp } from './dates.js'
import { escapeAttribute, escapeHtml, escapeTags, escapeUrlAttribute } from './escape.js'
import {
  channelMentionRegExp,
  commandRegExp,
  dateCommandRegExp,
  knownCommands,
  linkRegExp,
  mailToRegExp,
  subteamCommandRegExp,
  telRegExp,
  userMentionRegExp,
} from './patterns.js'
import type { PlaceholderStore } from './placeholders.js'
import { replaceEach } from './regexp.js'
import type { MatchGroups } from './regexp.js'
import type { ClassNames, SlackEscapeOptions } from './types.js'

const anchor = (href: string, label: string, external: boolean): string => {
  const safeHref = escapeUrlAttribute(href)
  if (!safeHref) {
    return escapeHtml(label)
  }
  const rel = external ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${safeHref}"${rel}>${escapeHtml(label)}</a>`
}

const renderDate = (
  groups: MatchGroups,
  fullMatch: string,
  classNames: ClassNames,
  timeZone: string
): string => {
  const timestamp = groups.dateTimestamp ?? ''
  const fallback = groups.dateFallback
  const formatted = formatSlackDate(timestamp, groups.dateFormat ?? '', { timeZone })
  // Slack always sends a fallback; prefer it over rendering nothing at all.
  const label = formatted?.trim() ? formatted : fallback

  if (label === undefined || label === '') {
    return escapeTags(fullMatch)
  }

  const body = groups.dateLink ? anchor(groups.dateLink, label, true) : escapeHtml(label)
  const isoTimestamp = toIsoTimestamp(timestamp)
  if (!isoTimestamp) {
    return body
  }
  return `<time datetime="${escapeAttribute(isoTimestamp)}" class="${escapeAttribute(
    classNames.date
  )}">${body}</time>`
}

/**
 * Renders every Slack `<...>` control sequence into HTML and swaps it for a
 * placeholder, so the surrounding text can be escaped without touching it.
 */
export const tokenizeControlSequences = (
  text: string,
  options: SlackEscapeOptions,
  classNames: ClassNames,
  placeholders: PlaceholderStore
): string => {
  const users = options.users ?? {}
  const channels = options.channels ?? {}
  const usergroups = options.usergroups ?? {}
  const timeZone = options.dateTimeZone ?? 'UTC'

  const store = (html: string): string => placeholders.add(html)

  return replaceEach(text, [
    [
      userMentionRegExp,
      (groups, fullMatch) => {
        const userName =
          groups.userName ??
          groups.userNameWithoutID ??
          (groups.userID ? users[groups.userID] : undefined)
        return store(
          userName
            ? `<span class="${escapeAttribute(classNames.userMention)}">@${escapeHtml(userName)}</span>`
            : escapeTags(fullMatch)
        )
      },
    ],
    [
      channelMentionRegExp,
      (groups, fullMatch) => {
        const channelName =
          groups.channelName ??
          groups.channelNameWithoutID ??
          (groups.channelID ? channels[groups.channelID] : undefined)
        return store(channelName ? `#${escapeHtml(channelName)}` : escapeTags(fullMatch))
      },
    ],
    [
      linkRegExp,
      (groups) => {
        const url = groups.linkUrl ?? ''
        return store(anchor(url, groups.linkHtml ?? url, true))
      },
    ],
    [
      mailToRegExp,
      (groups) => {
        const address = groups.mailTo ?? ''
        return store(anchor(`mailto:${address}`, groups.mailToName ?? address, true))
      },
    ],
    [
      telRegExp,
      (groups) => {
        const number = groups.tel ?? ''
        return store(anchor(`tel:${number}`, groups.telName ?? number, false))
      },
    ],
    [
      dateCommandRegExp,
      (groups, fullMatch) => store(renderDate(groups, fullMatch, classNames, timeZone)),
    ],
    [
      subteamCommandRegExp,
      (groups, fullMatch) => {
        const userGroupName =
          groups.subteamName ?? (groups.subteamID ? usergroups[groups.subteamID] : undefined)
        return store(userGroupName ? escapeHtml(userGroupName) : escapeTags(fullMatch))
      },
    ],
    [
      commandRegExp,
      (groups, fullMatch) => {
        const { commandLiteral, commandName } = groups
        if (commandLiteral?.startsWith('subteam') || commandLiteral?.startsWith('date')) {
          // Left for the dedicated patterns above; reaching here means the
          // sequence was malformed, so it is rendered as literal text.
          return store(escapeTags(fullMatch))
        }
        if (commandLiteral && knownCommands.includes(commandLiteral)) {
          return store(`@${escapeHtml(commandLiteral)}`)
        }
        return store(escapeTags(`<${commandName ?? commandLiteral ?? ''}>`))
      },
    ],
  ])
}
