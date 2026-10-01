# CP4: live enrichment smoke run (w2-enrich)

Run on 1 Oct 2026 from Node against the live open APIs, with the place data and Wikidata providers
(`runProviders` with `createOsmProvider` + `createWikidataProvider`), starting from 3 seed hotels
with only name, coordinates and `osm_id` set. The raw responses are recorded in
`tests/fixtures/enrichment/*.json` and replayed by the unit tests.

| Hotel | OSM (Overpass) | Wikidata match | Filled |
|---|---|---|---|
| Golden Tulip Al Barsha (`W91402276`) | 200, tags: `tourism=hotel`, `building:levels=7` — nothing we map | none (no candidate within 400 m sharing the name) | nothing; status `done`, fields stay ours to fill |
| Atlantis The Royal (`W1465036747`) | 200, `website` | `Q116730005` via careful search (name + 400 m) | website (OSM), Wikipedia summary, Commons image |
| Address Downtown (`W532836513`) | **504** from Overpass (provider failed, chain carried on) | `Q677823` via careful search | website (Wikidata P856), Wikipedia summary, Commons image |

## Attributions stored

- **Atlantis The Royal** — description: Wikipedia "Atlantis The Royal, Dubai" (CC BY-SA 4.0),
  `description_source: wikipedia`. Image: `File:Atlantis_The_Royal,_Dubai_1.jpg`, credit
  "EditQ · CC0 · Wikimedia Commons".
- **Address Downtown** — description: Wikipedia "Address Downtown" (CC BY-SA 4.0). Image:
  `File:View_from_Burj_Khalifa_(8667329327).jpg`, credit "Rob Young from United Kingdom · CC BY 2.0 ·
  Wikimedia Commons". (The P18 image is a view of the tower from Burj Khalifa: correct entity, and
  our own photos win as the cover anyway.)

## Notes

- Overpass is occasionally overloaded (504). The chain treats each provider separately, so one
  failure only loses that provider's fields; the run still ends `done`.
- Each OSM id is looked up at most once per device (`sn:overpass:<osm_id>` in localStorage).
- No booking site is ever contacted. Every request is an open API with `origin=*`.
