# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 2.0.1

No change in output. Verified byte-identical to 2.0.0 over the golden corpus and
4,000 generated inputs.

### Performance

- A markdown pass now returns immediately when the text cannot contain its
  delimiter, and a delimiter scan is reused by the following windows while it is
  still the first match at or after their start. The inline code pass splits the
  text into one window per code span, and every later pass previously scanned to
  the end of the text once per window. On a message of 2,000 inline code spans
  this drops from 111ms to 24ms.

### Internal

- Added `npm run fuzz:capture` and `npm run fuzz:compare`, which generate inputs
  from a fixed seed and compare a change against what the code produced
  beforehand. Changes to the delimiter matcher should be checked with it.

## 2.0.0

A full modernization of the package. The two public functions and their options
keep the same names, so most code needs no changes; see the
[migration notes](README.md#migrating-from-1x) for the behavior that differs.

### Security

- Interpolated values are now escaped for their context. Link URLs, link labels,
  display names from the supplied maps, custom emoji URLs and class names could
  previously break out of the attribute they were rendered into. Slack only
  encodes `&`, `<` and `>` in message text, so a label containing a quote
  character was enough to inject an event handler.
- `href` and `src` values must now use a safe scheme (`http`, `https`, `mailto`
  or `tel`). A custom emoji URL such as `javascript:alert(1)//https://x` was
  previously rendered into `src` because the URL check was unanchored.
- The message body is now escaped by default, so raw HTML in message text no
  longer reaches the output. Escaping is entity-aware, so text that Slack already
  encoded is not double-encoded. Opt out with `escapeHtml: false`.

### Added

- TypeScript types, generated from a TypeScript source rewrite ([#5](https://github.com/hectorbenitez/slack-to-html/issues/5)).
- Support for Slack's `<!date^timestamp^format^link|fallback>` sequences, with all
  of Slack's format tokens, a `dateTimeZone` option, and `<time datetime="...">`
  output.
- A `classNames` option to override the CSS classes on rendered elements, which
  the 1.x README had listed as upcoming.
- An `escapeHtml` option.
- A `slack-to-html/emoji` entry point exposing the emoji map on its own.
- Dual ESM and CommonJS builds with an `exports` map, plus a UMD build for
  `<script>` tags at `dist/umd/index.umd.js`.

### Fixed

- URLs containing colons are no longer partially consumed as emoji. A link with a
  text fragment such as `#:~:text=` lost characters ([#1](https://github.com/hectorbenitez/slack-to-html/issues/1)).
- An emoji shortname that matches nothing keeps its colons instead of having them
  stripped ([#4](https://github.com/hectorbenitez/slack-to-html/issues/4)).
- An `alias:` chain that loops no longer hangs.
- Emoji inside a rendered link's URL are no longer expanded, which previously
  corrupted the URL.
- The published package now contains a build that matches the source. 1.0.0 was
  published through the deprecated `prepublish` hook and shipped a `dist/` that
  predated the last two merged pull requests, along with a broken
  `dist/index.js` whose emoji module was missing from the tarball.

### Changed

- **Breaking:** the message body is escaped by default (see above).
- **Breaking:** unknown emoji shortnames keep their colons (see above).
- **Breaking:** unknown `<!command>` sequences render as escaped text rather than
  raw `<command>` tags.
- **Breaking:** ampersands in attribute values are encoded as `&amp;`, as HTML
  requires.
- **Breaking:** `dist/bundle.js` no longer exists; import the package name and let
  the `exports` map resolve the right build.
- **Breaking:** Node 20.19 or newer is required.
- `buildSlackHawkDownRegExps` is renamed to `buildSlackPatterns`; the old name is
  kept as a deprecated alias.
- Emoji data moved from a vendored 1.7 MB Emoji 5.0 snapshot to
  `emoji-datasource` 16.0, and now includes every shortname alias, so many more
  shortnames resolve. The dataset is a development dependency; the generated map
  is committed and verified in CI.
- The `xregexp` dependency was dropped for native regular expressions, making the
  package dependency-free.
- The delimiter matcher is iterative rather than recursive, so a message with many
  formatted spans no longer consumes stack proportional to the number of
  replacements.
- The published tarball dropped from 2.1 MB to roughly 400 KB unpacked; it no
  longer ships tests, fixtures, a screenshot or the raw emoji dataset.

### Tooling

- Babel 6 and browserify replaced with [tsdown](https://tsdown.dev).
- Mocha 3 and Chai 3 replaced with [Vitest](https://vitest.dev).
- ESLint 3 with `eslint-config-airbnb` replaced with ESLint's flat config,
  typescript-eslint and Prettier.
- GitHub Actions run lint, typecheck, tests, a build, and `publint` plus
  `arethetypeswrong` on every push. The packed tarball is then installed into a
  scratch project and smoke-tested on every Node version in `engines`, so the
  artifact that users actually consume is verified rather than assumed. Releases
  publish with npm provenance.
- `npm install` works again. The 1.x `prepublish` hook ran on install and failed.

## 1.0.0

- Initial release under the `slack-to-html` name, forked from
  [swiftype/slack-hawk-down](https://github.com/swiftype/slack-hawk-down).
