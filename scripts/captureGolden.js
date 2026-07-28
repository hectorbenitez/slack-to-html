/*
 * Snapshots the v1 implementation's output over a broad corpus of inputs so the
 * 2.0 rewrite can be verified against it. Run against the pre-rewrite v1 source
 * (Babel 6 + src/index.js); the committed corpus is the reference afterwards.
 *
 *   node scripts/captureGolden.js
 */

require('babel-core/register')

var fs = require('fs')
var path = require('path')
var slackToHtml = require('../src/index.js')

var customEmoji = {
  swiftype: 'https://swiftype.com/favicon.ico',
  goodbye: 'alias:wave',
  facepalm: 'http://emojis.slackmojis.com/emojis/images/1450319441/51/facepalm.png',
}
var users = { U123: 'someone', U456: 'another' }
var channels = { C123: 'channel' }
var usergroups = { S123: 'swiftype-eng' }
var allOptions = {
  customEmoji: customEmoji,
  users: users,
  channels: channels,
  usergroups: usergroups,
}

// [group, input, options]. Options of `null` means "call with no options".
var cases = [
  ['empty', '', null],
  ['empty', null, null],
  ['empty', undefined, null],
  ['plain', 'hello world', null],
  ['plain', 'a & b', null],
  ['plain', 'already &amp; escaped', null],
  ['plain', 'multi\nline\ntext', null],

  ['userMention', '<@U123|someone>', null],
  ['userMention', '<@U123>', { users: users }],
  ['userMention', '<@U123>', null],
  ['userMention', '<@someone>', null],
  ['userMention', '<@U123> and <@U456>', { users: users }],

  ['channelMention', '<#C123|channel>', null],
  ['channelMention', '<#C123>', { channels: channels }],
  ['channelMention', '<#C123>', null],
  ['channelMention', '<#channel>', null],

  ['link', '<https://swiftype.com>', null],
  ['link', '<https://swiftype.com|Swiftype>', null],
  ['link', '<http://example.com/a/b?c=d&e=f>', null],
  ['link', 'bare https://example.com url', null],

  ['mailto', '<mailto:test@swiftype.com>', null],
  ['mailto', '<mailto:test@swiftype.com|Test>', null],

  ['tel', '<tel:123-456-7890>', null],
  ['tel', '<tel:123-456-7890|Call me!>', null],

  ['subteam', '<!subteam^S123|swiftype-eng>', null],
  ['subteam', '<!subteam^S123>', { usergroups: usergroups }],
  ['subteam', '<!subteam^S123>', null],

  ['command', '<!here>', null],
  ['command', '<!channel>', null],
  ['command', '<!group>', null],
  ['command', '<!everyone>', null],
  ['command', '<!here|@here>', null],
  ['command', '<!foo|bar>', null],
  ['command', '<!foo>', null],

  ['emoji', ':wave:', null],
  ['emoji', ':wave: :wave:', null],
  ['emoji', ':wave::wave:', null],
  ['emoji', ':+1:', null],
  ['emoji', ':flag-mx:', null],
  ['emoji', 'text :wave: more text', null],
  ['emoji', ':swiftype:', { customEmoji: customEmoji }],
  ['emoji', ':goodbye:', { customEmoji: customEmoji }],
  ['emoji', ':swiftype: :goodbye:', { customEmoji: customEmoji }],
  ['emoji', ':swiftype::goodbye:', { customEmoji: customEmoji }],

  ['markdown-codeBlock', '```this is a code multiline```', { markdown: true }],
  ['markdown-codeBlock', '```this is a code multiline\nwith newlines```', { markdown: true }],
  ['markdown-codeBlock', '````this is a code multiline with backticks````', { markdown: true }],
  ['markdown-codeBlock', '```one``` ```two```', { markdown: true }],
  ['markdown-codeBlock', '```code with *asterisks*```', { markdown: true }],
  ['markdown-codeBlock', '```code``` with *bold* after', { markdown: true }],

  ['markdown-codeInline', '`inline code`', { markdown: true }],
  ['markdown-codeInline', '`one` and `two`', { markdown: true }],
  ['markdown-codeInline', '`code with *asterisks*`', { markdown: true }],

  ['markdown-bold', 'this is *bold*', { markdown: true }],
  ['markdown-bold', 'this is *bold*with*more*asterisks*', { markdown: true }],
  ['markdown-italic', 'this is _italic_', { markdown: true }],
  ['markdown-italic', '_italic_ at the start', { markdown: true }],
  ['markdown-italic', 'snake_case_word', { markdown: true }],
  ['markdown-strike', 'this is ~struck~', { markdown: true }],

  ['markdown-blockQuote', '&gt;&gt;&gt;this is a block quote', { markdown: true }],
  ['markdown-blockQuote', '&gt;&gt;&gt;block quote\nwith newlines', { markdown: true }],
  ['markdown-blockQuote', 'not whitespace &gt;&gt;&gt;not a block quote', { markdown: true }],
  ['markdown-inlineQuote', '&gt;inline quote', { markdown: true }],
  ['markdown-inlineQuote', '  \t   &gt;inline quote', { markdown: true }],
  ['markdown-inlineQuote', 'not whitespace &gt;not a quote', { markdown: true }],
  ['markdown-inlineQuote', '&gt;quote line\nnormal line', { markdown: true }],

  ['markdown-combined', '*bold* _italic_ ~struck~ `code`', { markdown: true }],
  ['markdown-combined', '*_bold italic_*', { markdown: true }],
  [
    'markdown-combined',
    '<@U123> said *hello* :wave:',
    Object.assign({ markdown: true }, allOptions),
  ],
  [
    'markdown-combined',
    '&gt;&gt;&gt;quote with *bold* and :wave:',
    Object.assign({ markdown: true }, allOptions),
  ],

  ['unmatchedDelimiter', 'unmatched *bold', { markdown: true }],
  ['unmatchedDelimiter', 'unmatched `code', { markdown: true }],
  ['unmatchedDelimiter', 'unmatched ```block', { markdown: true }],

  // Known-buggy inputs. These are captured to document current behavior; the
  // Phase 3 fixes intentionally change them (see test/goldenTest.ts).
  ['knownBug-issue1-urlColons', 'https://ex.com/a#:~:text=hello%20world', null],
  ['knownBug-issue4-unknownEmoji', 'hello :notanemoji: world', null],
  ['knownBug-issue4-unknownEmoji', ':customEmoji:', null],
  ['knownBug-rawHtml', '<script>alert(1)</script>', null],
  ['knownBug-rawHtml', '<img src=x onerror=alert(1)>', null],
  [
    'knownBug-attrBreakout',
    ':evil:',
    { customEmoji: { evil: 'http://e/x.png" onerror="alert(1)' } },
  ],
  ['knownBug-attrBreakout', '<@U1|"><b>label</b>>', null],
  ['knownBug-javascriptUrl', '<javascript:alert(1)|click me>', null],
]

var corpus = cases.map(function (testCase) {
  var group = testCase[0]
  var input = testCase[1]
  var options = testCase[2]
  var markdown = !!(options && options.markdown)
  var fn = markdown ? slackToHtml.escapeForSlackWithMarkdown : slackToHtml.escapeForSlack

  return {
    group: group,
    input: input === undefined ? null : input,
    inputIsUndefined: input === undefined,
    options: options,
    output: options ? fn(input, options) : fn(input),
  }
})

var outputPath = path.join(__dirname, '..', 'test', 'fixtures', 'golden.json')
fs.writeFileSync(outputPath, JSON.stringify(corpus, null, 2) + '\n', 'utf8')
console.log('Captured ' + corpus.length + ' cases to ' + outputPath)
