// The context of a task, read the way TaskGenius reads it after an "@": a
// name, as in "@Dev", or a note, as in "@[[Note]]" or "@[[Note|Alias]]"

// An "@" in a link, in inline code or in a URL starts no context
const PROTECTED_PATTERNS = [
  /\[\[[^\]]+\]\]/g,
  /\[[^\]]*\]\([^)]+\)/g,
  /(`+)([^`]|[^`].*?[^`])\1(?!`)/g,
  /(?:https?|ftp|mailto|file):\/\/[^\s<>"{}|\\^`[\]]+/g,
];

// A note as the context, right after the "@"
const LINK_START = /^\[\[[^[\]\n]+\]\]/;

// Names are letters, digits, "-" and "_", in any script, up to punctuation
const NAME_ENDS = new Set("，。；：！？「」『』（）【】");
const isNameChar = (char: string) =>
  /[0-9A-Za-z_-]/.test(char) ||
  (char.charCodeAt(0) > 127 && !NAME_ENDS.has(char));

// Before an "@" in the middle of a word, as in "me@example.com"
const WORD_CHAR = /[a-zA-Z0-9#@$%^&*]/;

interface ContextMatch {
  context: string;
  // Where "@context" starts and ends in the text
  start: number;
  end: number;
}

function findContexts(text: string): ContextMatch[] {
  const protectedRanges = PROTECTED_PATTERNS.flatMap((pattern) =>
    Array.from(text.matchAll(pattern), (m) => [
      m.index ?? 0,
      (m.index ?? 0) + m[0].length,
    ])
  );
  const contexts: ContextMatch[] = [];

  for (let at = text.indexOf("@"); at !== -1; at = text.indexOf("@", at + 1)) {
    const before = text[at - 1];
    if (before && !/\s/.test(before) && WORD_CHAR.test(before)) continue;
    if (protectedRanges.some(([start, end]) => at >= start && at < end)) {
      continue;
    }

    const rest = text.slice(at + 1);
    let length = LINK_START.exec(rest)?.[0].length ?? 0;
    if (length === 0) {
      while (length < rest.length && isNameChar(rest[length])) length++;
    }
    if (length === 0) continue;

    contexts.push({
      context: rest.slice(0, length),
      start: at,
      end: at + 1 + length,
    });
    at += length;
  }
  return contexts;
}

/** The context of a task, the last one when it has several, like TaskGenius */
export function parseContext(text: string): string | undefined {
  return findContexts(text).pop()?.context;
}

/** The text without its contexts, and the spaces before them */
export function removeContexts(text: string): string {
  return findContexts(text)
    .reverse()
    .reduce((result, { start, end }) => {
      let from = start;
      while (from > 0 && /\s/.test(result[from - 1])) from--;
      return result.slice(0, from) + result.slice(end);
    }, text);
}

/** The note a context links to, "[[Note|Alias]]" → "Note"; null for a name */
export function contextLinkTarget(context: string): string | null {
  if (LINK_START.exec(context)?.[0].length !== context.length) return null;
  return context.slice(2, -2).split("|")[0].trim() || null;
}

/** What Obsidian shows for a link: its alias, else the note, "[[Note#Part]]" → "Note > Part" */
export function contextLinkText(context: string): string {
  const [target, alias] = context.slice(2, -2).split("|");
  return (
    alias?.trim() ||
    target
      .split("#")
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" > ")
  );
}
