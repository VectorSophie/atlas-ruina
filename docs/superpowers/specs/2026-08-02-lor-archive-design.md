# Library of Ruina Public Archive — Phase 1 Design

## Goal

A public, static archive site for Library of Ruina's game data (cards, key pages, enemies,
abnormalities, passives, stages, and story), styled to look and feel like browsing the game's
actual in-game library/UI rather than a generic wiki. Phase 1 covers the data pipeline and the
archive site itself. A deck builder is an explicitly separate, later phase (see "Phase 2").

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
- **KeyPage** (`EquipPage_*.txt`, XML root `Book`): HP/stagger/resist stats; `TextId` → EN
  description; `CharacterSkin` → portrait.
- **Enemy** (`EnemyUnitInfo_*.txt`): → `BookId` (its key page), `DeckId` (its cards),
  `NameID` → `Names.txt` → `LocalizeID` → EN string.
- **Abnormality**: same family, EN text under `AbnormalityCards`/`AbnormalityAbilities`.
- **Passive** (`PassiveList_*.txt`): ID + rarity; text joined by ID the same way.
- **Stage/Floor** (`StageInfo_*.txt`): wave of Enemy IDs + Formation + `Story Condition`
  pointers into `Chapter_X_Y_Z.txt`.
- **Dialogue/Story** (`Chapter_*.txt`): per-scene script — background, BGM, and per-line
  character `Face`/`Body`/`Emotion`/`Pos` attributes (portraits are composited from parts,
  not flat images — see Visual System).

## Pipeline

1. **Parse**: script (Node or Python) reads each XML family, typed into structured records.
2. **Resolve**: join structural records to their EN localization files and to each other by
   ID (Card→text, Enemy→Name→Localize→text, Stage→Story→Chapter file, etc).
3. **Emit**: one JSON file per content type (`cards.json`, `keypages.json`, `enemies.json`,
   `abnormalities.json`, `passives.json`, `stages.json`, `story.json`...), each record keyed
   by its stable in-game ID.
4. **Resolve art**: for each record, look up its named sprite/texture in the raw
   `Texture2D`/`Sprite` dump by the internal asset name referenced in its XML
   (e.g. `Card.Artwork = "ch1_1"`), and copy/rename into a build-time asset directory keyed
   the same way as the JSON.

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
