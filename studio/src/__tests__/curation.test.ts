import { describe, expect, it } from "vitest";
import {
  addToCut,
  arrayMove,
  cutIds,
  moveCut,
  normalizeCut,
  removeFromCut,
  reorderCut,
  setCallout,
  setHero,
  setTagline,
  type Curation,
} from "../curation";

function base(): Curation {
  return {
    tagline: "Ship your story",
    heroShotId: "dashboard",
    shots: [
      { id: "dashboard", rank: 1, callout: "Command center", reason: "a" },
      { id: "editor", rank: 2, callout: "Write & ship", reason: "b" },
      { id: "analytics", rank: 3, callout: "Instant insight", reason: "c" },
    ],
    cuts: {
      "5": [{ id: "dashboard", seconds: 2.5 }, { id: "editor", seconds: 2.5 }],
      "15": [
        { id: "dashboard", seconds: 5 },
        { id: "editor", seconds: 5 },
        { id: "analytics", seconds: 5 },
      ],
      "30": [{ id: "dashboard", seconds: 30 }],
      "45": [{ id: "dashboard", seconds: 45 }],
    },
  };
}

const sum = (cut: { seconds: number }[]) => cut.reduce((a, s) => a + s.seconds, 0);

describe("text edits", () => {
  it("rewrites the tagline without mutating the original", () => {
    const c = base();
    const next = setTagline(c, "New tagline");
    expect(next.tagline).toBe("New tagline");
    expect(c.tagline).toBe("Ship your story"); // original untouched (immutable)
  });

  it("renames a shot's callout", () => {
    const next = setCallout(base(), "editor", "Ship instantly");
    expect(next.shots.find((s) => s.id === "editor")?.callout).toBe("Ship instantly");
  });

  it("sets a new hero", () => {
    expect(setHero(base(), "analytics").heroShotId).toBe("analytics");
  });
});

describe("arrayMove", () => {
  it("moves an item and clamps out-of-range targets", () => {
    expect(arrayMove(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(arrayMove(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
  });
});

describe("reorderCut", () => {
  it("changes the order shots are layered into the video, preserving the total", () => {
    const c = base();
    const next = reorderCut(c, "15", 0, 2); // dashboard to the end
    expect(cutIds(next, "15")).toEqual(["editor", "analytics", "dashboard"]);
    expect(sum(next.cuts["15"])).toBe(15); // seconds unchanged → still valid
  });

  it("moveCut nudges a shot up/down and no-ops at the edges", () => {
    const c = base();
    expect(cutIds(moveCut(c, "15", "analytics", -1), "15")).toEqual([
      "dashboard",
      "analytics",
      "editor",
    ]);
    // Already first — nudging up keeps order.
    expect(cutIds(moveCut(c, "15", "dashboard", -1), "15")).toEqual(cutIds(c, "15"));
  });
});

describe("include / exclude re-balance seconds to the tier total", () => {
  it("removes a shot and keeps the tier sum valid", () => {
    const next = removeFromCut(base(), "15", "editor");
    expect(cutIds(next, "15")).toEqual(["dashboard", "analytics"]);
    expect(sum(next.cuts["15"])).toBeCloseTo(15, 5);
  });

  it("adds a shot and keeps the tier sum valid", () => {
    const next = addToCut(base(), "5", "analytics");
    expect(cutIds(next, "5")).toContain("analytics");
    expect(sum(next.cuts["5"])).toBeCloseTo(5, 5);
  });

  it("normalizeCut scales an arbitrary cut to the exact tier total", () => {
    const out = normalizeCut([{ id: "a", seconds: 1 }, { id: "b", seconds: 3 }], 30);
    expect(sum(out)).toBeCloseTo(30, 5);
  });
});
