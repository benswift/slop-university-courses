# Slop University course catalogue

The "programs and courses" register at
[courses.slop.university](https://courses.slop.university), built from the
versioned `/api/index.json` that every published SlopU course site emits.

`src/data/sources.json` is the publication registry (`apiUrl`, `sourceUrl`).
`pnpm catalogue:sync` refreshes the checked-in catalogue, then the normal
typecheck/test/lint/format/build suite runs over the result.

## How the sync behaves

Feeds are validated per course, not as a batch: a malformed feed, a relaxed
field bound or a duplicate `SLOPxxxx` code costs that one course and is
reported with a reason, rather than taking the whole cohort's catalogue with
it. The build-time schema that produces a feed lives in the course author's own
repo and can be edited there, so nothing upstream can be treated as a
guarantee.

Each entry keeps the ETag it was served with, so a sync revalidates with a
conditional request and reuses the body on a 304. The catalogue file is left
untouched when nothing changed, which is what keeps a no-op sync from
generating a commit, a rebuild and a deploy.

Feeds carry a `schemaVersion`. The shape is emitted by
`astro-course-university`, so that package --- not this repo --- is where the
contract actually lives; a field added there must be declared here or the
strict parse will reject every feed at once.

## The program builder

`/program/` assembles the courses a visitor has hearted into a program, checks
it against the award rules, and hands back a shareable link.

The rules live in `src/lib/program.ts` as data, so changing what constitutes a
program is one edit there: an undergraduate program is two courses at each of
levels 1-4, a masters two at each of 6 and 8. Level 7 is legal in the feed
schema but has no courses, and counts toward neither.

A selection travels in the URL as `?p=1007.1039.1101` --- the codes with the
redundant `SLOP` dropped --- alongside an optional `?n=` naming the program.
Both pages read an incoming `?p=`: the builder offers to save it, the register
previews it. Neither writes to `localStorage` until the visitor asks, so
opening someone else's link never overwrites your own program.

The name is attacker-controlled display text. `sanitiseName` strips control,
bidi and zero-width characters and caps the length, and the pages only ever
render it through `textContent`, an input `value` or `URLSearchParams`.

## Canonical URLs

`https://courses.slop.university/SLOPxxxx/` is reserved as each course's
canonical URL, and published course sites already emit it in their feed.
Serving the complete course sites at those paths needs an origin mirror or
reverse proxy; until that exists the plan is a static redirect stub per course.
