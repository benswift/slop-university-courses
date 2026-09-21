import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { entrySchema } from "../src/lib/catalogue";

// Card artwork for the register, captured rather than hotlinked.
//
// Every published course site emits an og:image at 1200x630: its own hero
// where it has one, and a generated code-and-title card where it doesn't.
// Both read as a card, and it is a standard field rather than a guess at which
// <img> on the page is the hero.
//
// Captured because a hotlink inherits exactly the weakness of the /SLOPxxxx/
// redirect stubs --- the artwork would live on someone else's deployment and
// vanish with it --- and because 123 uncached cross-origin requests is not a
// page load. Files are named by course code, so the page can resolve one
// without the catalogue carrying a second path to keep in step.
const cardsDir = resolve("src/assets/cards");
const cataloguePath = resolve("src/data/catalogue.json");

const OG_IMAGE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;

const entries = entrySchema
  .array()
  .catch([])
  .parse(JSON.parse(await readFile(cataloguePath, "utf8").catch(() => "[]")));

await mkdir(cardsDir, { recursive: true });
const existing = new Set(
  (await readdir(cardsDir).catch(() => [])).filter((f) => f.endsWith(".jpg")),
);

let captured = 0;
let kept = 0;
const missing: string[] = [];

await Promise.all(
  entries.map(async (entry) => {
    const code = entry.feed.course.code;
    const file = `${code}.jpg`;
    // The page is only re-read when the card is absent: a course whose feed
    // still matches has not rebuilt, so its card cannot have moved either.
    if (existing.has(file)) {
      kept++;
      return;
    }
    // The landing page, which is what the stub sends a visitor to.
    const page = entry.apiUrl.replace(/api\/index\.json$/, "");
    try {
      const html = await fetch(page).then((r) => (r.ok ? r.text() : ""));
      const url = OG_IMAGE.exec(html)?.[1];
      if (!url) {
        missing.push(code);
        return;
      }
      const image = await fetch(url);
      if (!image.ok) {
        missing.push(code);
        return;
      }
      await writeFile(join(cardsDir, file), Buffer.from(await image.arrayBuffer()));
      captured++;
    } catch {
      missing.push(code);
    }
  }),
);

// A course dropped from the register should not leave its artwork behind.
const wanted = new Set(entries.map((e) => `${e.feed.course.code}.jpg`));
const stale = [...existing].filter((file) => !wanted.has(file));
await Promise.all(stale.map((file) => unlink(join(cardsDir, file))));
const pruned = stale.length;

console.log(
  `Cards: ${captured} captured, ${kept} already held, ${missing.length} without an og:image, ${pruned} pruned.`,
);
if (missing.length > 0) console.log(`  no og:image: ${missing.toSorted().join(", ")}`);
