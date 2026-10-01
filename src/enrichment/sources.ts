/** Human attribution lines for `description_source` values. "us" (typed by hand) needs none. */
const LINES: Record<string, string> = {
  wikipedia: 'From Wikipedia, CC BY-SA 4.0',
  wikidata: 'From Wikidata, CC0',
  osm: 'From OpenStreetMap contributors, ODbL',
  places: 'From Google Maps',
};

export function sourceLabel(source: string): string | null {
  return LINES[source.toLowerCase()] ?? null;
}
