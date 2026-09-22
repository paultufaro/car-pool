import type { Family, Route } from "@prisma/client";
import { milesBetween, milesFromSegment } from "./geo";

export type MatchScore = {
  milesFromOrigin: number;
  milesFromPath: number;
  matches: boolean;
};

/**
 * MVP proximity matching: a family matches a route when its home is within the
 * route's radius of the origin area, or within that radius of the straight
 * origin→destination path. Swap this for driving-distance matching via a
 * routing API when one is configured.
 */
export function scoreFamilyAgainstRoute(family: Family, route: Route): MatchScore {
  const home = { lat: family.homeLat, lng: family.homeLng };
  const origin = { lat: route.originLat, lng: route.originLng };
  const destination = { lat: route.destinationLat, lng: route.destinationLng };
  const milesFromOrigin = milesBetween(home, origin);
  const milesFromPath = milesFromSegment(home, origin, destination);
  return {
    milesFromOrigin,
    milesFromPath,
    matches:
      milesFromOrigin <= route.matchRadiusMiles || milesFromPath <= route.matchRadiusMiles,
  };
}

export function rankRoutesForFamily<T extends Route>(
  family: Family,
  routes: T[],
): { route: T; score: MatchScore }[] {
  return routes
    .map((route) => ({ route, score: scoreFamilyAgainstRoute(family, route) }))
    .filter((entry) => entry.score.matches)
    .sort((a, b) => a.score.milesFromOrigin - b.score.milesFromOrigin);
}

export function rankFamiliesForRoute<T extends Family>(
  route: Route,
  families: T[],
): { family: T; score: MatchScore }[] {
  return families
    .map((family) => ({ family, score: scoreFamilyAgainstRoute(family, route) }))
    .filter((entry) => entry.score.matches)
    .sort((a, b) => a.score.milesFromOrigin - b.score.milesFromOrigin);
}
