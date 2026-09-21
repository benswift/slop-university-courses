import { describe, expect, it } from "vitest";
import {
  assess,
  AWARDS,
  bestAward,
  buildShareUrl,
  decodeCodes,
  encodeCodes,
  type Level,
  levelOf,
  MAX_COURSES,
  MAX_NAME,
  normaliseCodes,
  resolveAgainstCatalogue,
  sameSelection,
  sanitiseName,
  SHARE_LIMIT,
  shareText,
} from "./program";

const BASE = "https://courses.slop.university";

const undergraduate = AWARDS.find((a) => a.id === "undergraduate")!;
const masters = AWARDS.find((a) => a.id === "masters")!;

/** A selection satisfying an award exactly, as levels. */
const levelsFor = (award: typeof undergraduate): Level[] =>
  award.requirements.flatMap(
    ({ level, count }) => Array.from<number>({ length: count }).fill(level) as Level[],
  );

describe("levelOf", () => {
  it.each([
    ["SLOP1007", 1],
    ["SLOP4785", 4],
    ["SLOP8024", 8],
  ])("reads the level out of %s", (code, level) => {
    expect(levelOf(code)).toBe(level);
  });
});

describe("normaliseCodes", () => {
  it("sorts, so an equal selection always encodes the same way", () => {
    expect(normaliseCodes(["SLOP3422", "SLOP1007"])).toEqual(
      normaliseCodes(["SLOP1007", "SLOP3422"]),
    );
  });

  it("deduplicates", () => {
    expect(normaliseCodes(["SLOP1007", "SLOP1007"])).toEqual(["SLOP1007"]);
  });

  it("drops anything that is not a course code", () => {
    expect(normaliseCodes(["SLOP1007", "SLOP5000", "COMP4020", "", "SLOP123", "slop1007"])).toEqual(
      ["SLOP1007"],
    );
  });

  it("caps the list well above the size of the catalogue", () => {
    expect(MAX_COURSES).toBeGreaterThan(125);
    const many = Array.from({ length: MAX_COURSES + 50 }, (_, i) =>
      i < 1000 ? `SLOP1${String(i % 1000).padStart(3, "0")}` : "SLOP1000",
    );
    expect(normaliseCodes(many)).toHaveLength(MAX_COURSES);
  });
});

describe("sameSelection", () => {
  it("ignores order", () => {
    expect(sameSelection(["SLOP1007", "SLOP3422"], ["SLOP3422", "SLOP1007"])).toBe(true);
  });

  it("ignores duplicates on either side", () => {
    expect(sameSelection(["SLOP1007", "SLOP1007"], ["SLOP1007"])).toBe(true);
  });

  it("treats two empty selections as the same", () => {
    expect(sameSelection([], [])).toBe(true);
  });

  it("separates a subset from a superset", () => {
    expect(sameSelection(["SLOP1007"], ["SLOP1007", "SLOP3422"])).toBe(false);
  });
});

describe("resolveAgainstCatalogue", () => {
  const known = ["SLOP1007", "SLOP3422"];

  it("splits codes the register still carries from ones it does not", () => {
    expect(resolveAgainstCatalogue(["SLOP1007", "SLOP1999"], known)).toEqual({
      known: ["SLOP1007"],
      unknown: ["SLOP1999"],
    });
  });

  it("reports everything as unknown against an empty register", () => {
    expect(resolveAgainstCatalogue(["SLOP1007"], [])).toEqual({ known: [], unknown: ["SLOP1007"] });
  });

  it("handles an empty selection", () => {
    expect(resolveAgainstCatalogue([], known)).toEqual({ known: [], unknown: [] });
  });
});

describe("the URL codec", () => {
  it("drops the redundant prefix", () => {
    expect(encodeCodes(["SLOP1007", "SLOP1039"])).toBe("1007.1039");
  });

  it("round-trips", () => {
    const codes = ["SLOP1007", "SLOP2096", "SLOP3422", "SLOP8024"];
    expect(decodeCodes(encodeCodes(codes))).toEqual(codes);
  });

  it("keeps a full undergraduate program's parameter short", () => {
    const codes = Array.from({ length: 8 }, (_, i) => `SLOP${i + 1}00${i}`);
    expect(encodeCodes(codes).length).toBeLessThan(50);
  });

  it.each([null, undefined, "", "   "])("decodes %p to nothing", (param) => {
    expect(decodeCodes(param)).toEqual([]);
  });

  it("keeps the salvageable parts of a mangled parameter", () => {
    expect(decodeCodes("1007..nonsense.5000.2096")).toEqual(["SLOP1007", "SLOP2096"]);
  });

  it("caps a hostile parameter", () => {
    const param = Array.from({ length: 500 }, (_, i) => `1${String(i).padStart(3, "0")}`).join(".");
    expect(decodeCodes(param)).toHaveLength(MAX_COURSES);
  });
});

describe("sanitiseName", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitiseName("  Applied   Puddle\tStudies ")).toBe("Applied Puddle Studies");
  });

  it("strips control characters", () => {
    expect(sanitiseName("Bachelor\u0000 of\u001b Ruin")).toBe("Bachelor of Ruin");
  });

  it("strips bidi overrides, which could otherwise reorder the heading", () => {
    expect(sanitiseName("Bachelor‮of Ruin")).toBe("Bachelorof Ruin");
  });

  it("strips zero-width characters", () => {
    expect(sanitiseName("Bachelor​of Ruin")).toBe("Bachelorof Ruin");
  });

  it("caps the length", () => {
    expect(sanitiseName("x".repeat(500))).toHaveLength(MAX_NAME);
  });

  it.each([null, undefined, ""])("maps %p to the empty string", (raw) => {
    expect(sanitiseName(raw)).toBe("");
  });
});

describe("assess", () => {
  it("reports an empty selection as wholly outstanding", () => {
    const progress = assess(undergraduate, []);
    expect(progress.complete).toBe(false);
    expect(progress.counted).toBe(0);
    expect(progress.outstanding).toBe(8);
  });

  it("completes on an exact selection", () => {
    const progress = assess(undergraduate, levelsFor(undergraduate));
    expect(progress.complete).toBe(true);
    expect(progress.outstanding).toBe(0);
    expect(progress.lines.every((line) => line.met)).toBe(true);
  });

  it("tracks a partial selection level by level", () => {
    const progress = assess(undergraduate, [1, 1, 2]);
    expect(progress.complete).toBe(false);
    expect(progress.outstanding).toBe(5);
    expect(progress.lines.find((line) => line.level === 1)).toMatchObject({ have: 2, met: true });
    expect(progress.lines.find((line) => line.level === 2)).toMatchObject({ have: 1, met: false });
  });

  it("does not let a surplus at one level pay for a gap at another", () => {
    const progress = assess(masters, [6, 6, 6, 6]);
    expect(progress.complete).toBe(false);
    expect(progress.counted).toBe(2);
    expect(progress.outstanding).toBe(2);
  });

  it("ignores levels no award asks for", () => {
    const progress = assess(masters, [...levelsFor(masters), 7, 7]);
    expect(progress.complete).toBe(true);
    expect(progress.counted).toBe(4);
  });
});

describe("bestAward", () => {
  it("picks the award a selection completes", () => {
    expect(bestAward(levelsFor(masters)).award.id).toBe("masters");
  });

  it("picks the closest when none is complete", () => {
    expect(bestAward([6, 8]).award.id).toBe("masters");
  });

  it("prefers a complete award over a closer incomplete one", () => {
    expect(bestAward([...levelsFor(masters), 1, 2, 3, 4]).award.id).toBe("masters");
  });
});

describe("buildShareUrl", () => {
  it("puts the selection and the name in the query", () => {
    const url = new URL(buildShareUrl(BASE, ["SLOP1007"], "Applied Ruin"));
    expect(url.pathname).toBe("/program/");
    expect(url.searchParams.get("p")).toBe("1007");
    expect(url.searchParams.get("n")).toBe("Applied Ruin");
  });

  it("omits empty parameters", () => {
    expect(buildShareUrl(BASE, [], "")).toBe(`${BASE}/program/`);
  });

  it("encodes a name that would otherwise break the query", () => {
    const raw = 'Ruin & "Puddles" ?p=9999#x';
    const url = new URL(buildShareUrl(BASE, ["SLOP1007"], raw));
    expect(url.searchParams.get("n")).toBe(raw);
    expect(url.searchParams.get("p")).toBe("1007");
  });
});

describe("shareText", () => {
  const courses = [
    { code: "SLOP1039", title: "Ruin: A First Course in Losing Money" },
    { code: "SLOP1101", title: "Applied Human Cat Care" },
  ];
  const url = `${BASE}/program/?p=1039.1101`;

  it("names the program, the size and the courses", () => {
    const text = shareText({ name: "Applied Ruin", courses, awardName: "masters program", url });
    expect(text).toContain("Applied Ruin");
    expect(text).toContain("2 courses");
    expect(text).toContain("a complete masters program");
    expect(text).toContain("SLOP1039 Ruin: A First Course in Losing Money");
    expect(text).toContain(url);
    expect(text).toContain("#slopU");
  });

  it("falls back to a default name", () => {
    expect(shareText({ name: "", courses, url })).toContain("My program");
  });

  it("omits the standing when no award is complete", () => {
    expect(shareText({ name: "Half a plan", courses, url })).not.toContain("complete");
  });

  it("uses the singular for one course", () => {
    expect(shareText({ name: "Minimal", courses: courses.slice(0, 1), url })).toContain("1 course");
  });

  it("trims a long title at a word boundary rather than dropping it", () => {
    const text = shareText({
      name: "Applied Ruin",
      courses: [
        {
          code: "SLOP1007",
          title: "Retail Market Survival: Risk, Leverage and Execution for Small Accounts",
        },
      ],
      url,
    });
    expect(text).toContain("SLOP1007 Retail Market Survival");
    expect(text).toContain("…");
    expect(text).not.toContain("Small Accounts");
  });

  it("stays within the limit for a full program with a named share link", () => {
    const long = Array.from({ length: 8 }, (_, i) => ({
      code: `SLOP${i + 1}00${i}`,
      title: "A ludicrously overlong course title that goes on and on".repeat(2),
    }));
    const text = shareText({
      name: "Bachelor of Applied Ruin",
      courses: long,
      awardName: "undergraduate program",
      url: `${BASE}/program/?p=1007.1039.2034.2096.3030.3068.4022.4122&n=Bachelor+of+Applied+Ruin`,
    });
    expect(text.length).toBeLessThanOrEqual(SHARE_LIMIT);
    expect(text).toContain("Build your own:");
  });

  it("keeps the link even when nothing else can be given up", () => {
    // A very long URL can exceed the limit on its own. The post runs over
    // rather than shipping without the thing it exists to share.
    const text = shareText({
      name: "x".repeat(MAX_NAME),
      courses,
      url: `${BASE}/program/?p=${"1007.".repeat(60)}`,
    });
    expect(text).toContain("Build your own:");
    expect(text).not.toContain("Including");
  });

  it("never shouts", () => {
    expect(shareText({ name: "Applied Ruin", courses, url })).not.toContain("!");
  });
});
