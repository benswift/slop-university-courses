// The viewer's own program, kept in localStorage. This is a per-viewer
// convenience, never something the site depends on: a private window throws on
// read as readily as on write, and a blocked or cleared store must degrade to
// "nothing saved yet" rather than breaking the page. Every access is guarded,
// and what comes back is re-validated — a store is as hand-editable as a URL.

import { normaliseCodes, sanitiseName } from "./program";

export const CODES_KEY = "slopu:favourites";
export const NAME_KEY = "slopu:program-name";

export function readCodes(): string[] {
  try {
    const raw = localStorage.getItem(CODES_KEY);
    return normaliseCodes(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return [];
  }
}

export function writeCodes(codes: Iterable<string>): void {
  try {
    localStorage.setItem(CODES_KEY, JSON.stringify(normaliseCodes(codes)));
  } catch {
    /* Nothing to do: the selection still works for this page view. */
  }
}

export function readName(): string {
  try {
    return sanitiseName(localStorage.getItem(NAME_KEY));
  } catch {
    return "";
  }
}

export function writeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, sanitiseName(name));
  } catch {
    /* As above. */
  }
}
