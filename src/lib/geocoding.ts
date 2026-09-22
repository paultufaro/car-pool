import type { Coordinates } from "./geo";

export type GeocodeResult = Coordinates & {
  /** Coarse area label safe to show to other members instead of a street address. */
  neighborhood: string;
};

type Town = { name: string; aliases: string[]; lat: number; lng: number };

/**
 * Pilot gazetteer: Summit NJ plus the towns reachable for cross-town activities.
 * Used when no geocoding provider is configured.
 */
const TOWNS: Town[] = [
  { name: "Summit, NJ", aliases: ["summit"], lat: 40.7156, lng: -74.3646 },
  { name: "Chatham, NJ", aliases: ["chatham"], lat: 40.7409, lng: -74.3838 },
  { name: "New Providence, NJ", aliases: ["new providence"], lat: 40.6984, lng: -74.4015 },
  { name: "Berkeley Heights, NJ", aliases: ["berkeley heights"], lat: 40.6829, lng: -74.4429 },
  { name: "Short Hills, NJ", aliases: ["short hills", "millburn"], lat: 40.7387, lng: -74.3268 },
  { name: "Madison, NJ", aliases: ["madison"], lat: 40.7598, lng: -74.4171 },
  { name: "Springfield, NJ", aliases: ["springfield"], lat: 40.7048, lng: -74.3179 },
];

const DEFAULT_TOWN = TOWNS[0];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function townFor(address: string): Town {
  const normalized = address.toLowerCase();
  return (
    TOWNS.find((town) => town.aliases.some((alias) => normalized.includes(alias))) ?? DEFAULT_TOWN
  );
}

/** Deterministic offset so addresses in a town spread over ~1.5 miles instead of stacking. */
function localGeocode(address: string): GeocodeResult {
  const town = townFor(address);
  const seed = hash(address.trim().toLowerCase());
  const latOffset = ((seed % 200) / 200 - 0.5) * 0.022;
  const lngOffset = (((seed >> 8) % 200) / 200 - 0.5) * 0.028;
  return {
    lat: Number((town.lat + latOffset).toFixed(6)),
    lng: Number((town.lng + lngOffset).toFixed(6)),
    neighborhood: town.name,
  };
}

async function mapboxGeocode(address: string, token: string): Promise<GeocodeResult | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address,
  )}.json?limit=1&country=US&access_token=${token}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const body = (await response.json()) as {
    features?: { center: [number, number]; context?: { id: string; text: string }[] }[];
  };
  const feature = body.features?.[0];
  if (!feature) return null;
  const place = feature.context?.find((entry) => entry.id.startsWith("place."))?.text;
  const region = feature.context?.find((entry) => entry.id.startsWith("region."))?.text;
  return {
    lng: feature.center[0],
    lat: feature.center[1],
    neighborhood: [place, region].filter(Boolean).join(", ") || townFor(address).name,
  };
}

/**
 * Resolves a street address to coordinates plus a coarse area label. Falls back
 * to the built-in gazetteer when no provider is configured or the provider fails.
 */
export async function geocode(address: string): Promise<GeocodeResult> {
  const token = process.env.MAPBOX_TOKEN;
  if (process.env.GEOCODER === "mapbox" && token) {
    try {
      const result = await mapboxGeocode(address, token);
      if (result) return result;
    } catch {
      // fall through to the local gazetteer
    }
  }
  return localGeocode(address);
}

export const pilotTowns = TOWNS.map((town) => town.name);
