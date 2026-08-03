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

Covers all chapters and bosses for Cards, Key Pages, Enemies (with resolved deck card lists),
plus Decks, Passives, Stages, Story (narrative text), and the Abnormality codex. Output is
`pipeline/data/{cards,keypages,enemies,passives,stages,story,abnormalityCodex}.json`.

Run `npm run parse` and check the console summary line for current record counts — they'll
change if the source data does, so this README doesn't hardcode them.

## Known limitations

- **Art resolution rate is low** (a few percent of cards). This is a source-data
  characteristic, not a pipeline defect: most `Card.Artwork` XML values don't match any actual
  filename in the raw Unity Texture2D/Sprite dump. Only motion-suffixed shared sprites and a
  handful of specially-illustrated cards resolve today.
- **Story scene staging (background/BGM/character-art cues) is not yet linked to the narrative
  text.** `story.json` (from `EN_Chapter*.txt`) has the actual dialogue lines. The separate
  `Chapter_X_Y_Z.txt` files hold scene staging (background, BGM, character position/emotion)
  but a verified, reliable way to link a specific staging entry to a specific narrative line
  hasn't been established yet — building that link without a confirmed mapping risks the same
  kind of silent-wrong-pairing bug the `EquipPage` `TextId` fix addressed. Deferred until the
  site's Story reader UI defines what it actually needs from staging data.
- **Enemy key pages/decks for the `_creature` (Abnormality) family use the same file families**
  as regular enemies (`EquipPage_creature_*.txt`, `Deck_creature*.txt`) and are included in
  this pass's full-coverage glob — no separate handling needed, confirmed by the schema checks
  done during design.
