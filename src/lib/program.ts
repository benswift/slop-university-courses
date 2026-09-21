// A "program" at Slop University is whatever a visitor assembles from the
// register and chooses to call a degree. This module owns the rules that
// decide when a selection amounts to one, the URL codec that makes a selection
// shareable, and the social copy. It is pure: no DOM, no storage, no fetch —
// the pages supply the state and render the result.

/** Course levels the feed schema allows. Only 1-4, 6 and 8 appear in the
 *  catalogue today; 7 is legal, and counts toward no award. */
export type Level = 1 | 2 | 3 | 4 | 6 | 7 | 8;

export interface Requirement {
  level: Level;
  count: number;
}

export interface Award {
  id: string;
  name: string;
  requirements: Requirement[];
}

/** The award rules, as data: changing what constitutes a program is an edit
 *  here and nowhere else. */
export const AWARDS: Award[] = [
  {
    id: "undergraduate",
    name: "undergraduate program",
    requirements: [
      { level: 1, count: 2 },
      { level: 2, count: 2 },
      { level: 3, count: 2 },
      { level: 4, count: 2 },
    ],
  },
  {
    id: "masters",
    name: "masters program",
    requirements: [
      { level: 6, count: 2 },
      { level: 8, count: 2 },
    ],
  },
];

/** A parse guard, not a product limit: it sits well above the size of the
 *  whole catalogue so hearting everything still shares cleanly, while a
 *  hostile URL cannot hand the page an unbounded list to render. */
export const MAX_COURSES = 200;

/** Long enough for a grandiose degree title, short enough to render in a
 *  heading and a social post. */
export const MAX_NAME = 80;

/** Bluesky's limit, and a reasonable ceiling for the rest. */
export const SHARE_LIMIT = 300;

const UNIVERSITY = "Slop University";

const FULL_CODE = /^SLOP([1-4]|[6-8])\d{3}$/;
const SHORT_CODE = /^([1-4]|[6-8])\d{3}$/;

/** The level is the digit after the prefix; the code pattern guarantees it. */
export function levelOf(code: string): Level {
  return Number(code[4]) as Level;
}

/** Sorted, deduplicated and capped. Sorting is what makes two equal selections
 *  produce byte-identical URLs, which is how the builder tells a shared
 *  program from the viewer's own. */
export function normaliseCodes(codes: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const code of codes) if (FULL_CODE.test(code)) seen.add(code);
  return [...seen].toSorted().slice(0, MAX_COURSES);
}

/** `SLOP1007`, `SLOP1039` -> `1007.1039`. The prefix is on every code, so
 *  dropping it keeps a full program's parameter short enough to read aloud. */
export function encodeCodes(codes: Iterable<string>): string {
  return normaliseCodes(codes)
    .map((code) => code.slice(4))
    .join(".");
}

/** Order-insensitive: the viewer's own list arrives in click order and a
 *  decoded one is sorted, so comparing them as sets is what tells an opened
 *  share link apart from the viewer's own selection. */
export function sameSelection(a: Iterable<string>, b: Iterable<string>): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const code of left) if (!right.has(code)) return false;
  return true;
}

/** A code can be well formed and still not be a course: the register changes,
 *  and links outlive it. Splitting the two lets the page say "since retired"
 *  rather than "broken link". The catalogue is passed in so this module keeps
 *  no dependency on the data, matching `catalogue.ts`. */
export function resolveAgainstCatalogue(
  codes: Iterable<string>,
  known: Iterable<string>,
): { known: string[]; unknown: string[] } {
  const index = new Set(known);
  const resolved: string[] = [];
  const missing: string[] = [];
  for (const code of codes) (index.has(code) ? resolved : missing).push(code);
  return { known: resolved, unknown: missing };
}

/** Anything unparseable is dropped rather than failing the page: a truncated
 *  or hand-edited link should still show the courses it got right. */
export function decodeCodes(param: string | null | undefined): string[] {
  if (!param) return [];
  const codes: string[] = [];
  for (const part of param.split(".")) if (SHORT_CODE.test(part)) codes.push(`SLOP${part}`);
  return normaliseCodes(codes);
}

/** The name arrives from the URL, so it is attacker-controlled display text.
 *  Control characters and the bidi/zero-width ranges are stripped here so no
 *  caller has to remember that a heading can be reordered by its content. */
export function sanitiseName(raw: string | null | undefined): string {
  if (!raw) return "";
  let out = "";
  for (const ch of raw) {
    const c = ch.codePointAt(0) ?? 0;
    // Tabs and newlines are word separators, so they become spaces; deleting
    // them the way we delete the other control characters would weld two
    // words together.
    if (/\s/.test(ch)) {
      out += " ";
      continue;
    }
    const invisible =
      c < 0x20 ||
      c === 0x7f ||
      (c >= 0x200b && c <= 0x200f) ||
      (c >= 0x202a && c <= 0x202e) ||
      (c >= 0x2066 && c <= 0x2069);
    if (!invisible) out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

export interface RequirementProgress {
  level: Level;
  have: number;
  need: number;
  met: boolean;
}

export interface AwardProgress {
  award: Award;
  lines: RequirementProgress[];
  complete: boolean;
  /** Courses that count toward this award, surplus at a level not included. */
  counted: number;
  /** Courses still to be added before the award is satisfied. */
  outstanding: number;
}

export function assess(award: Award, levels: Iterable<Level>): AwardProgress {
  const tally = new Map<Level, number>();
  for (const level of levels) tally.set(level, (tally.get(level) ?? 0) + 1);

  const lines = award.requirements.map(({ level, count }) => {
    const have = tally.get(level) ?? 0;
    return { level, have, need: count, met: have >= count };
  });

  return {
    award,
    lines,
    complete: lines.every((line) => line.met),
    counted: lines.reduce((sum, line) => sum + Math.min(line.have, line.need), 0),
    outstanding: lines.reduce((sum, line) => sum + Math.max(0, line.need - line.have), 0),
  };
}

/** The award a selection best fits: the one it completes, or failing that the
 *  one it is closest to finishing. Ties go to the earlier rule. */
export function bestAward(levels: Iterable<Level>, awards: Award[] = AWARDS): AwardProgress {
  const materialised = [...levels];
  const progress = awards.map((award) => assess(award, materialised));
  return progress.reduce((best, next) => {
    if (best.complete !== next.complete) return best.complete ? best : next;
    return next.outstanding < best.outstanding ? next : best;
  });
}

/** Built with URLSearchParams, so the name cannot break out of the query
 *  however it is spelled. */
export function buildShareUrl(base: string | URL, codes: Iterable<string>, name: string): string {
  const url = new URL("/program/", base);
  const p = encodeCodes(codes);
  if (p) url.searchParams.set("p", p);
  const n = sanitiseName(name);
  if (n) url.searchParams.set("n", n);
  return url.toString();
}

export interface ShareCourse {
  code: string;
  title: string;
}

/** Course titles run to 87 characters in the register, and two of those plus a
 *  named share link overruns any post. Trimming at a word boundary keeps the
 *  sample readable where dropping it would leave the post saying nothing about
 *  what is in the program. */
const TITLE_SAMPLE = 48;

function shorten(title: string, limit = TITLE_SAMPLE): string {
  if (title.length <= limit) return title;
  const cut = title.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  // Fall back to a hard cut for a single very long word.
  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Copy for a social post: what the program is called, how big it is, whether
 *  it amounts to anything, and a couple of courses as bait. It gives up detail
 *  in order — two courses, then one, then none, then a shortened display name
 *  — rather than overrunning. No exclamation marks: the house voice is deadpan.
 *
 *  `SHARE_LIMIT` is best effort, not a guarantee. The link is the one thing a
 *  share post cannot do without, and a long program's URL can exceed the limit
 *  on its own, so the post is allowed to run over rather than ship broken. */
export function shareText(options: {
  name: string;
  courses: ShareCourse[];
  awardName?: string;
  url: string;
}): string {
  const { courses, url } = options;
  const name = sanitiseName(options.name) || "My program";
  const count = `${courses.length} course${courses.length === 1 ? "" : "s"}`;
  const standing = options.awardName ? `, a complete ${options.awardName}` : "";
  const tail = `Build your own: ${url}\n#slopU`;

  const sample = courses.slice(0, 2).map((course) => `${course.code} ${shorten(course.title)}`);

  const compose = (displayName: string, take: number) => {
    const head = `${displayName} — ${count}${standing} at ${UNIVERSITY}.`;
    if (take === 0) return `${head}\n${tail}`;
    const listed = sample.slice(0, take).join(" and ");
    // An elided title already ends in a full stop's worth of punctuation.
    const stop = listed.endsWith("…") ? "" : ".";
    return `${head}\nIncluding ${listed}${stop}\n${tail}`;
  };

  const candidates = [
    ...[2, 1, 0].map((take) => compose(name, take)),
    compose(shorten(name, 32), 0),
  ];
  return candidates.find((text) => text.length <= SHARE_LIMIT) ?? candidates.at(-1)!;
}
