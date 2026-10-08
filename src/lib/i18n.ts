import { moment } from "obsidian";

export interface LocalizedText {
  en: string;
  zh: string;
}

/**
 * Picks the text for Obsidian's language. Like TaskGenius, the language is
 * taken from moment's locale, which Obsidian sets to the app language.
 */
export function localize(text: LocalizedText): string {
  const locale = typeof moment?.locale === "function" ? moment.locale() : "en";
  return locale.startsWith("zh") ? text.zh : text.en;
}
