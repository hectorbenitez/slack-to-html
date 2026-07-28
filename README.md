# slack-to-html

[![npm](https://img.shields.io/npm/v/slack-to-html.svg)](https://www.npmjs.com/package/slack-to-html)
[![CI](https://github.com/hectorbenitez/slack-to-html/actions/workflows/ci.yml/badge.svg)](https://github.com/hectorbenitez/slack-to-html/actions/workflows/ci.yml)

Render Slack message text as HTML: mentions, links, emoji, dates and Slack's
`mrkdwn` formatting.

- **Zero runtime dependencies**
- **TypeScript types included**
- **ESM, CommonJS and a standalone browser build**
- **Escapes by default**, so message text cannot inject HTML
- Emoji data from [emoji-datasource](https://github.com/iamcal/emoji-data) (Emoji 16.0)

Originally forked from [swiftype/slack-hawk-down](https://github.com/swiftype/slack-hawk-down).

## Install

```bash
npm install slack-to-html
```

Requires Node 20.19 or newer, or any modern browser.

## Usage

```js
import { escapeForSlack, escapeForSlackWithMarkdown } from 'slack-to-html'

escapeForSlack(':wave:')
// => '<span title=":wave:">&#x1F44B;</span>'

escapeForSlackWithMarkdown('`code`')
// => '<span class="slack_code"><code>code</code></span>'
```

CommonJS works too:

```js
const { escapeForSlack } = require('slack-to-html')
```

And there is a standalone build for a `<script>` tag, exposing the global
`slackToHtml`:

```html
<script src="https://unpkg.com/slack-to-html"></script>
<script>
  slackToHtml.escapeForSlack(':wave:')
</script>
```

## API

### `escapeForSlack(text, options?)`

Renders control sequences (mentions, links, dates, commands) and emoji, and
escapes everything else. Returns an empty string for `null`, `undefined` or `''`.

### `escapeForSlackWithMarkdown(text, options?)`

The same, with Slack's `mrkdwn` formatting enabled. Equivalent to passing
`{ markdown: true }`.

### Options

| Option         | Type                     | Default | Description                                                    |
| -------------- | ------------------------ | ------- | -------------------------------------------------------------- |
| `users`        | `Record<string, string>` | `{}`    | User ID to name, from [`users.list`][users]                    |
| `channels`     | `Record<string, string>` | `{}`    | Channel ID to name, from [`conversations.list`][channels]      |
| `usergroups`   | `Record<string, string>` | `{}`    | Subteam ID to name, from [`usergroups.list`][usergroups]       |
| `customEmoji`  | `Record<string, string>` | `{}`    | Shortname to image URL or `alias:`, from [`emoji.list`][emoji] |
| `markdown`     | `boolean`                | `false` | Render `mrkdwn` formatting                                     |
| `escapeHtml`   | `boolean`                | `true`  | Encode `&`, `<` and `>` in the message body                    |
| `classNames`   | `Partial<ClassNames>`    | —       | Override the CSS classes on rendered elements                  |
| `dateTimeZone` | `string`                 | `'UTC'` | IANA timezone for `<!date^...>` sequences                      |

[users]: https://docs.slack.dev/reference/methods/users.list
[channels]: https://docs.slack.dev/reference/methods/conversations.list
[usergroups]: https://docs.slack.dev/reference/methods/usergroups.list
[emoji]: https://docs.slack.dev/reference/methods/emoji.list

Also exported: `expandEmoji`, `emojiData`, `defaultClassNames`,
`buildSlackPatterns`, and the `SlackEscapeOptions`, `ClassNames`, `NameMap` and
`CustomEmojiMap` types. The emoji map is available on its own from
`slack-to-html/emoji` if you want it without the renderer.

## What gets rendered

### Markdown

Pass `markdown: true` (or use `escapeForSlackWithMarkdown`).

| Input               | Output                                              |
| ------------------- | --------------------------------------------------- |
| `*bold*`            | `<span class="slack_bold">bold</span>`              |
| `_italic_`          | `<span class="slack_italics">italic</span>`         |
| `~struck~`          | `<span class="slack_strikethrough">struck</span>`   |
| `` `code` ``        | `<span class="slack_code"><code>code</code></span>` |
| ` ```block``` `     | `<div class="slack_code"><code>block</code></div>`  |
| `&gt;quote`         | `<span class="slack_block">quote</span>`            |
| `&gt;&gt;&gt;quote` | `<div class="slack_block">quote</div>`              |

The full set of styles Slack supports is documented in
[Slack's formatting reference](https://docs.slack.dev/messaging/formatting-message-text).

### Mentions and links

```js
escapeForSlack('<@U123|david> did you see my pull request?', { users: { U123: 'david' } })
// => '<span class="user-mention">@david</span> did you see my pull request?'

escapeForSlack('<#C123> please fill out this poll', { channels: { C123: 'general' } })
// => '#general please fill out this poll'

escapeForSlack('<!subteam^S123>', { usergroups: { S123: 'acme-eng' } })
// => 'acme-eng'

escapeForSlack('<https://example.com|Example>')
// => '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Example</a>'

escapeForSlack('<!here> standup in 5')
// => '@here standup in 5'
```

An ID with no matching entry in the map is rendered as escaped literal text, so
nothing is silently dropped.

### Emoji

```js
escapeForSlack(':wave:')
// => '<span title=":wave:">&#x1F44B;</span>'

escapeForSlack(':facepalm:', {
  customEmoji: { facepalm: 'https://emoji.example.com/facepalm.png' },
})
// => '<img alt="facepalm" src="https://emoji.example.com/facepalm.png" title=":facepalm:" class="slack_emoji" />'
```

Custom emoji may point at another shortname with `alias:wave`. A shortname that
matches nothing is left exactly as written:

```js
escapeForSlack('deploy at 10:30:00 :shipit:')
// => 'deploy at 10:30:00 :shipit:'
```

### Dates

Slack sends `<!date^timestamp^format^optional_link|fallback>` and expects each
client to format it in the reader's timezone. Since a server-side renderer has no
reader, dates are formatted in UTC unless you pass `dateTimeZone`:

```js
escapeForSlack('<!date^1392734382^Posted {date_short} at {time}|Feb 18, 2014>')
// => '<time datetime="2014-02-18T14:39:42.000Z" class="slack_date">Posted Feb 18, 2014 at 2:39 PM</time>'

escapeForSlack('<!date^1392734382^{date_short} {time}|Feb 18, 2014>', {
  dateTimeZone: 'America/Mexico_City',
})
// => '<time datetime="2014-02-18T14:39:42.000Z" class="slack_date">Feb 18, 2014 8:39 AM</time>'
```

All of Slack's tokens are supported: `{date_num}`, `{date}`, `{date_short}`,
`{date_long}`, their `_pretty` variants (which render `today`, `yesterday` or
`tomorrow` where applicable), `{time}` and `{time_secs}`. If the timestamp cannot
be formatted, Slack's own fallback text is used.

### Custom class names

```js
escapeForSlackWithMarkdown('*bold*', { classNames: { bold: 'font-bold' } })
// => '<span class="font-bold">bold</span>'
```

Any subset of `code`, `bold`, `italics`, `strikethrough`, `block`, `emoji`,
`userMention` and `date` may be overridden; see `defaultClassNames` for the
defaults.

## Escaping and safety

The output of this library is HTML intended to be inserted into a page, so it is
worth being precise about what is escaped.

**Interpolated values are always escaped.** Link URLs, link labels, display
names, emoji URLs and class names are escaped for their context, and `href` and
`src` values must use a safe scheme (`http`, `https`, `mailto` or `tel`) or they
are dropped. This cannot be turned off. Note that Slack only encodes `&`, `<` and
`>` in message text, so a link label containing a quote character reaches you
unencoded — that is the case this protects against.

**The message body is escaped once.** `&`, `<` and `>` are encoded, but an
existing entity is left alone:

```js
escapeForSlack('<script>alert(1)</script>')
// => '&lt;script&gt;alert(1)&lt;/script&gt;'

escapeForSlack('Ben &amp; Jerry &lt;3')
// => 'Ben &amp; Jerry &lt;3'
```

This matters because Slack delivers message text with those three characters
already encoded. Escaping unconditionally would turn a real Slack payload's
`&gt;&gt;&gt;` block quote into `&amp;gt;...` and stop it rendering, so escaping
has to be idempotent. The trade-off is that text you pass which happens to
contain a literal `&amp;` is treated as an already-encoded entity.

Set `escapeHtml: false` to pass the body through untouched, if you sanitize
elsewhere or deliberately want to allow HTML. Interpolated values are still
escaped.

This library does not sanitize HTML. If you accept message text from untrusted
sources and need stronger guarantees, run the output through a sanitizer such as
[DOMPurify](https://github.com/cure53/DOMPurify).

## Migrating from 1.x

2.0 keeps the same two functions and the same option names, so most code needs no
changes. What differs:

- **The message body is now escaped by default.** If you were relying on raw HTML
  passing through, set `escapeHtml: false`.
- **Unknown emoji shortnames keep their colons.** `:shipit:` used to render as
  `shipit`; it now renders as `:shipit:` ([#4](https://github.com/hectorbenitez/slack-to-html/issues/4)).
- **URLs containing colons are no longer mangled.** A link with a text fragment
  such as `#:~:text=` used to lose characters ([#1](https://github.com/hectorbenitez/slack-to-html/issues/1)).
- **Unknown `<!command>` sequences are escaped** rather than emitted as raw
  `<command>` tags.
- **Ampersands inside attributes are encoded**, so `?a=1&b=2` in an `href`
  becomes `?a=1&amp;b=2` as HTML requires.
- **`buildSlackHawkDownRegExps` is now `buildSlackPatterns`.** The old name still
  works and is deprecated.
- **`dist/bundle.js` is gone.** The package now has an `exports` map; import the
  package name rather than a file path. For a `<script>` tag use
  `dist/umd/index.umd.js`, which unpkg and jsDelivr serve by default.
- **Node 20.19+ is required**, and the emoji dataset moved from Emoji 5.0 to
  Emoji 16.0, so many more shortnames now resolve.

## Development

```bash
npm install
npm test              # vitest
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run build         # tsdown: ESM, CJS, UMD and .d.ts
npm run generate-emoji  # regenerate src/emojiData.ts from emoji-datasource
```

The build tooling requires Node 22 or newer, even though the published package
supports Node 20.19+. CI enforces the difference: it runs the tooling on a current
Node, then installs the packed tarball and runs `scripts/smokeTest.mjs` against
every Node version in `engines`.

`test/fixtures/golden.json` is a snapshot of 1.x's output over a broad corpus of
inputs. `test/golden.test.ts` asserts the current implementation still matches it,
with every deliberate difference listed explicitly, so behavior cannot drift by
accident.

## Contributing

Issues and pull requests are welcome.

## License

MIT
