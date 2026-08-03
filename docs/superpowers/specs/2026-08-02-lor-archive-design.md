# Library of Ruina Public Archive — Phase 1 Design

## Goal

A public, static archive site for Library of Ruina's game data (cards, key pages, enemies,
abnormalities, passives, stages, and story), styled to look and feel like browsing the game's
actual in-game library/UI rather than a generic wiki. Phase 1 covers the data pipeline and the
archive site itself. A deck builder is an explicitly separate, later phase (see "Phase 2").

**Status:** Phase 1a (data pipeline), first slice, is done and merged — a working pipeline
proving the full parse→localize→cross-reference→resolve-art→emit pattern on Chapter 1
Cards/KeyPages/Enemies. This doc now also covers Phase 1a's remaining scope: full chapter/boss
coverage for Card/KeyPage/Stage, plus new parsers for Deck, Passive, Stage, Story, and the
Abnormality codex — see "Data Model" and "Pipeline" below, updated after inspecting the actual
remaining source files. The Astro site (Phase 1b) is not yet started.

## Source Data

Three local folders (already downloaded from the user's Google Drives to
`C:\Workspace\lor-assets-unzipped\`), verified complete:

| Folder | Contents | Notes |
|---|---|---|
| `Library Of Ruina Assets` | `Font/`(5), `Sprite/`(4782), `TextAsset/`(929), `Texture2D/`(3748) | Raw Unity AssetRipper/AssetStudio dump. `TextAsset` is Korean-only structural data. `Sprite`/`Texture2D` are named by literal internal Unity asset name — the source of truth for ID→art lookup. |
| `LOR Cards` | `Sprite/`(754) + 2 profiler files | Profiler files are irrelevant noise, ignore. |
| `Library of Ruina - Organized Assets` | `Audio/`(589), `Images/`(2582), `Text/`(~140 files × 5 locales: Korean/English/Japanese/Chinese/Traditional Chinese), `Fonts/`(8), `Videos/`(3) | Hand-curated by a third party. `Text/English/EN_*.txt` is the critical localization source. `Images/` is hand-sorted by chapter/theme, not ID-addressable — useful as a secondary/browse layer, not the pipeline backbone. |

No further data collection is needed. Community references consulted for schema/taxonomy
validation (not as data sources): [Tiphereth Database](https://tiphereth.zasz.su/) (unofficial
LOR/Lobotomy Corp db), its
[card scraper](https://github.com/TunaFish2K/library-of-ruina-card-data-scraper), and the
[Cogitopedia](https://projectmoon.miraheze.org/wiki/Module:Ruina_Card) wiki's card data module.

## Data Model

The raw files separate **structure** from **localization**, cross-referenced by numeric ID.
The pipeline's core job is resolving this ID graph into denormalized, self-contained JSON
records — not just XML→JSON per file.

- **Card** (`CardInfo_*.txt`): stats/behavior, Korean name baked in → joined with
  `Text/English/EN_BattleCards*.txt` (same ID) for display name/ability text.
- **KeyPage** (`EquipPage_*.txt`, XML root `Book`): HP/stagger/resist stats; localization
  joined via `TextId` (**not** the Book's own `@ID`, which can diverge — verified: they
  coincide in Chapter 1 but not in Chapters 2+ or the enemy/creature key page files) → EN
  name/description; `CharacterSkin` → portrait.
- **Enemy** (`EnemyUnitInfo_*.txt`): → `BookId` (its key page, resolved via `EquipPage_*.txt`),
  `DeckId` (→ resolved via a **Deck** record, see below — `DeckId` is one indirection removed,
  not a Card ID itself), `NameID` → `EN_CharactersName.txt`/`EN_CreatureName.txt` (numeric ID
  keyed directly — no indirection through `Names.txt`'s `LocalizeID` is actually needed, since
  the EN name files are keyed by the same plain numeric ID).
- **Deck** (`Deck_*.txt`/`Deck_enemy_*.txt`, XML root `DeckXmlRoot > Deck[@ID] > Card[]`): a
  named list of Card IDs. New, small parser — resolves `Enemy.deckId` into an actual card list.
- **Abnormality combat data**: not a separate structural family — verified directly from the
  files that Library of Ruina's Abnormality/superboss encounters reuse the exact same schemas
  under a `_creature` naming convention: `CardInfo_creature_*.txt` (same `DiceCardXmlRoot` as
  regular cards, localized via `EN_BattleCards_Creature*.txt`, same `BattleCardDescRoot` shape),
  `EquipPage_creature_*.txt`/`EquipPage_enemy_*.txt` (same `BookXmlRoot` shape), and
  `StageInfo_creature.txt` (same `StageXmlRoot` shape). These reuse the existing Card/KeyPage
  parsers as-is — covering them is a manifest problem (which structural file pairs with which
  localization file), not new parser code.
- **Abnormality codex/profile** (`Text/English/EN_AbnormalityCards.txt` only — self-contained,
  no separate Korean structural file): `Sephirah[@SephirahType] > AbnormalityCard[@ID]` where
  `@ID` is a **string** (e.g. `"ScorchedGirl_Walk"`), not numeric. Holds the lore-facing entry:
  `Abnormality` (creature name), `CardName`, `AbilityDesc` (prose ability text), `FlavorText`,
  and a `Dialogues` list of combat barks. This is a genuinely new, distinct parser — it's the
  profile/lore layer (matching Tiphereth's "Abno Pages"), separate from the creature's combat
  cards above.
- **Passive** (`PassiveList*.txt`: ID + Level + Rarity) joined with `EN_PassiveDesc*.txt`
  (`PassiveDescRoot > PassiveDesc[@ID] > Name, Desc`) by ID. New parser, same join-by-ID
  pattern as everything else. Creature passives use `EN_CreaturePassive*.txt`, same shape.
- **Stage/Floor** (`StageInfo*.txt`, XML root `StageXmlRoot > Stage[@id]`): `Wave > Unit[]`
  (Enemy IDs) + `Formation` + `Story Condition="Start"/"End"` pointers into
  `Chapter_X_Y_Z.txt`. New parser. `StageInfo_creature.txt` reuses the same shape for
  Abnormality encounters.
- **Dialogue/Story** (`Chapter_*.txt`, XML root `SceneEffect > Dialogue[@ID]`): per-scene
  script — background (`Bg`), BGM, `Filter`, and a `CharacterList` of per-line character
  `Name`/`Face`/`Body`/`Pos`/`Emotion`/`Telling` attributes (portraits are composited from
  parts, not flat images — see Visual System). One shared schema applied across ~250+ files
  (main chapters `Chapter_1_*` through `Chapter_8_*`, plus side-story/reception scripts
  `Chapter_100_*`, `Chapter_101_*`, `Chapter_1000_*`, etc). New parser, applied broadly rather
  than per-file bespoke code.

## Pipeline

1. **Parse**: script (Node/TypeScript) reads each XML family, typed into structured records.
2. **Resolve**: join structural records to their EN localization files and to each other by
   ID (Card→text, Enemy→Name→text, Deck→Cards, Stage→Enemies/Story→Chapter file, etc).
3. **Emit**: one JSON file per content type (`cards.json`, `keypages.json`, `enemies.json`,
   `decks.json`, `passives.json`, `stages.json`, `story.json`, `abnormalityCodex.json`), each
   record keyed by its stable in-game ID.
4. **Resolve art**: for each record, look up its named sprite/texture in the raw
   `Texture2D`/`Sprite` dump by the internal asset name referenced in its XML
   (e.g. `Card.Artwork = "ch1_1"`), and copy/rename into a build-time asset directory keyed
   the same way as the JSON. Known limitation, verified against real Chapter 1 data: most
   `Card.Artwork` values don't match any real filename (only ~3% resolve) — most common cards
   apparently don't have unique per-card art in this dump, only shared motion sprites and a
   handful of specially-illustrated cards. Not a pipeline defect; documented as-is.

**Full-coverage parsing is a manifest problem, not new-parser-per-chapter work**: since Card,
KeyPage, and Stage parsers already handle every chapter/creature variant of their XML shape,
covering "all chapters + all bosses" means building a manifest — a list of
`{structuralFile, localizationFile}` pairs (e.g. `CardInfo_ch2.txt` ↔ `EN_BattleCards.txt`,
`CardInfo_ch7_Philip.txt` ↔ `EN_BattleCards_Ch7_Philip.txt`, `CardInfo_creature_hokma.txt` ↔
`EN_BattleCards_Creature.txt`) — and running the existing parser once per pair, not writing
bespoke code per chapter.

Re-runnable end-to-end: if better/more source data shows up later, re-run rather than
hand-edit output.

## Visual System

Goal: recreate the actual in-game UI chrome (frames, dice, panels, portraits) using the real
extracted assets, not a generic reskin — confirmed against Tiphereth's own approach (which
simplifies to flat cards + icon badges) as the baseline to exceed.

The in-game UI is genuinely layered, confirmed directly from asset filenames:

- **Blend layers**: files like `DiceCard_bufLinearDodge`, `*_LinearDodge` are separate
  transparent overlays using Unity's "Linear Dodge (Add)" blend mode → reproduced with CSS
  `mix-blend-mode: plus-lighter`, stacked as absolutely-positioned images in fixed order.
- **Alpha masks**: files like `AbCard_PopUp_Illust_ClipingMask`/`_Coverage` → reproduced with
  CSS `mask-image` (alpha mode) using the same PNG as the mask source.
- **9-slice frames**: `frame.png`, `FrameUpper.png`, `PanelHighlightFrame` → reproduced with
  CSS `border-image`, the web-native 9-slice equivalent, so one frame texture wraps content
  of any size.
- **Composited portraits**: dialogue data has per-line `Face`/`Body`/`Emotion`/`Pos`
  attributes — portraits are assembled live from part sprites, not flat images. Reproduced
  the same way: a portrait component layering body+face+emotion sprites by the same
  attributes.

Build approach: small reusable "layer stack" components (base → mask → blend-glow → frame,
fixed order), driven by data — not hand-positioned pixels per entity. For the few most
visually complex screens (illustration popups with many stacked layers), pre-flatten to a
single PNG once at build time (headless canvas/Playwright render step) rather than
live-compositing on every page load. Simple pieces (dice icons, cost badges, plain frames)
stay as live CSS layers since they're cheap and need to be interactive/swappable.

Fonts used as-is from the extracted `Font`/`Fonts` folders: `Arita-buriM.otf` (Project Moon's
signature UI font) for headers/UI chrome, `Railway.otf` for Latin body/UI text.

## Site Architecture

- **IA**: Library (home) → bookshelves by chapter/city (Canard, Urban Myth, Urban Legend...)
  → per-entity pages (Card, Key Page, Enemy, Abnormality) → Story reader (scene-by-scene,
  driven by the dialogue script data, with character art/BGM cues) → full-text search across
  all entity types.
- **Stack**: Astro (static-first, ships zero JS by default, straightforward to hand-build
  pixel UI components in), data baked in at build time from the pipeline's JSON output,
  Pagefind for client-side search, deployed free on Cloudflare Pages or GitHub Pages.
- **Why static**: the game is complete and its data won't change; no backend/database needed;
  matches the architecture of comparable community projects (retcons/limbus-storylogs,
  limbus-logs) which datamine game files directly into static sites.

## Out of Scope (Phase 1)

- **Deck builder**: depends on Phase 1's card data existing first. Separate design pass once
  Phase 1 ships.
- **Combat/dice simulator**: not requested for Phase 1.

## Risks / Considerations

- **Asset redistribution**: the site republishes extracted copyrighted game assets (art,
  fonts, audio) as its visual system. Tiphereth and the Fandom/Cogitopedia wikis operate this
  way without apparent issue (community reference-database norms), but this isn't a legal
  guarantee — worth the user's own awareness going in, especially for full audio/video reuse.
