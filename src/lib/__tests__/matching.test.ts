import { describe, expect, it } from "vitest";
import type { Family, Route } from "@prisma/client";
import { scoreFamilyAgainstRoute } from "../matching";

const family = (lat: number, lng: number) =>
  ({ id: "f", homeLat: lat, homeLng: lng }) as Family;

// Summit pickup area heading to a field in Chatham.
const route = {
  id: "r",
  originLat: 40.7156,
  originLng: -74.3646,
  destinationLat: 40.7409,
  destinationLng: -74.3838,
  matchRadiusMiles: 1,
} as Route;

describe("scoreFamilyAgainstRoute", () => {
  it("matches a family a few blocks from the origin", () => {
    const score = scoreFamilyAgainstRoute(family(40.7181, -74.3669), route);
    expect(score.milesFromOrigin).toBeLessThan(1);
    expect(score.matches).toBe(true);
  });

  it("matches a family along the path but far from the origin", () => {
    const score = scoreFamilyAgainstRoute(family(40.7305, -74.3752), route);
    expect(score.milesFromPath).toBeLessThan(1);
    expect(score.matches).toBe(true);
  });

  it("rejects a family in another town off the path", () => {
    const score = scoreFamilyAgainstRoute(family(40.6829, -74.4429), route);
    expect(score.matches).toBe(false);
  });
});
