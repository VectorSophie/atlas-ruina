# LOR Archive — Data Pipeline

Parses raw Library of Ruina game data (XML extracted from the Unity build) into clean JSON
for the archive site.

## Setup

1. Make sure you have the three source asset folders downloaded locally (see
   `docs/superpowers/specs/2026-08-02-lor-archive-design.md` for what they contain and where
   they came from).
2. `cd pipeline && npm install`
3. `cp .env.example .env` and edit the two paths to match where you put the source folders.

## Run

```bash
npm run parse
```

Output lands in `pipeline/data/`:
- `cards.json`, `keypages.json`, `enemies.json` — parsed, English-localized records
- `art/` — copied art files, one per record that had a resolvable sprite/texture

## Test

```bash
npm test
```

## Status

Currently covers Chapter 1 cards, key pages, and enemies as a proof of the full pipeline
pattern (parse → localize → cross-reference → resolve art → emit). Remaining chapters and
entity types (Abnormality, Passive, Stage, Story) follow the same pattern and are tracked as
a follow-up plan.

A real run against Chapter 1 source data produces 29 cards, 15 key pages, and 16 enemies —
use these as a sanity check against your own local run.

## Known limitations

Art resolution is currently very low (~1 of 29 cards, ~3%). This is a source-data
characteristic, not a pipeline defect: most `Card.Artwork` XML values don't match any actual
filename in the raw Unity Texture2D/Sprite dump. Only motion-suffixed shared sprites and a
handful of specially-illustrated cards resolve today. Improving the filename-matching
heuristic to close this gap is tracked as follow-up work.

`enemies.json`'s `bookId`/`deckId` fields are not yet resolvable against `keypages.json`/
`cards.json`. They point into a different file family (`EquipPage_enemy_*.txt`,
`Deck_enemy_*.txt`) than the ones this pipeline currently parses, and `deckId` is one
indirection removed — it names a deck list of card IDs, not a card ID itself. Resolving these
needs new parsers for that file family, not just "more chapters" of the current ones; tracked
as follow-up work alongside the remaining entity types.
