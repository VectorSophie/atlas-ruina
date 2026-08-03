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
- `cards.json`, `keypages.json`, `enemies.json`, `passives.json`, `stages.json`, `story.json`,
  `abnormalityCodex.json` — parsed, English-localized records
- `art/` — copied art files, one per record that had a resolvable sprite/texture

## Test

```bash
npm test
```

## Status

Covers all chapters and bosses for Cards, Key Pages, Enemies (with resolved deck card lists),
plus Decks, Passives, Stages, Story (narrative text), and the Abnormality codex. Output is
`pipeline/data/{cards,keypages,enemies,passives,stages,story,abnormalityCodex}.json`.

Run `npm run parse` and check the console summary line for current record counts — they'll
change if the source data does, so this README doesn't hardcode them.

Every output file is deduped by id (`dedupeById()` in `src/index.ts`) — a handful of ids are
legitimately defined more than once across source files (e.g. a seasonal-event enemy repeated
across chapter files, or a card also present in a boss's alternate-phase file). Duplicates with
identical content are silently merged; a `console.warn` fires during `npm run parse` if two
records for the same id ever have *different* content, since that would mean a real data
conflict worth investigating, not a harmless re-definition. `CardInfo_ch1.txt`'s companion
`CardInfoJan.txt` is excluded from parsing entirely — it's leftover dev-prototype data (a
different, older XML schema with literal placeholder card names) that both produced corrupted
records of its own and collided with 6 real chapter-1 card ids.

## Known limitations

- **Art resolution rate is ~40%** (651 of 1613 cards, verified against a real full-coverage
  run). Many cards' `Card.Artwork` XML values don't match any actual filename in the raw Unity
  Texture2D/Sprite dump — some cards use shared motion sprites with no unique per-card art,
  which is a source-data characteristic, not a pipeline defect. The rate varies noticeably by
  chapter/card type (early-chapter common cards resolve far less often than later-chapter or
  special/creature cards, which tend to have dedicated art).
- **Story scene staging (background/BGM/character-art cues) is not yet linked to the narrative
  text.** `story.json` (from `EN_Chapter*.txt`) has the actual dialogue lines. The separate
  `Chapter_X_Y_Z.txt` files hold scene staging (background, BGM, character position/emotion)
  but a verified, reliable way to link a specific staging entry to a specific narrative line
  hasn't been established yet — building that link without a confirmed mapping risks the same
  kind of silent-wrong-pairing bug the `EquipPage` `TextId` fix addressed. Deferred until the
  site's Story reader UI defines what it actually needs from staging data.
- **Enemy key pages/decks for the `_creature` (Abnormality) family use the same file families**
  as regular enemies (`EquipPage_creature_*.txt`, `Deck_creature*.txt`), confirmed by the schema
  checks done during design. However, ~23% of creature/abnormality enemies with a `deckId`
  (56 of 244) don't resolve to any known deck — their `deckId` values genuinely don't appear in
  any `Deck_creature*.txt` file. `deckCardIds` degrades to an empty array for these rather than
  erroring, which is correct handling, but the underlying deck data for these enemies may not
  exist in this source dump. Not yet investigated further.
