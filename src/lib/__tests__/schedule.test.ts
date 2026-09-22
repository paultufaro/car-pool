import { describe, expect, it } from "vitest";
import { buildRotation } from "../schedule";

const MONDAY = new Date("2026-01-05T00:00:00.000Z");

describe("buildRotation", () => {
  it("gives each family a full week in a weekly rotation", () => {
    const rotation = buildRotation(["a", "b"], [1, 3, 5], 1, MONDAY, 2);
    expect(rotation).toHaveLength(6);
    expect(rotation.slice(0, 3).map((entry) => entry.familyId)).toEqual(["a", "a", "a"]);
    expect(rotation.slice(3).map((entry) => entry.familyId)).toEqual(["b", "b", "b"]);
  });

  it("holds each family for two weeks in a biweekly rotation", () => {
    const rotation = buildRotation(["a", "b"], [2], 2, MONDAY, 4);
    expect(rotation.map((entry) => entry.familyId)).toEqual(["a", "a", "b", "b"]);
  });

  it("skips days earlier in the current week", () => {
    const wednesday = new Date("2026-01-07T00:00:00.000Z");
    const rotation = buildRotation(["a"], [1, 3, 5], 1, wednesday, 1);
    expect(rotation.map((entry) => entry.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-07",
      "2026-01-09",
    ]);
  });

  it("keeps the rotation in phase when regenerated mid-cycle", () => {
    const secondWeek = new Date("2026-01-12T00:00:00.000Z");
    const fresh = buildRotation(["a", "b"], [1], 1, secondWeek, 2, MONDAY);
    expect(fresh.map((entry) => entry.familyId)).toEqual(["b", "a"]);
  });

  it("produces nothing without families or days", () => {
    expect(buildRotation([], [1], 1, MONDAY)).toEqual([]);
    expect(buildRotation(["a"], [], 1, MONDAY)).toEqual([]);
  });
});
