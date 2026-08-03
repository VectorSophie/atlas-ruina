# Site Core: Cards Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Astro site (`site/`) and prove the full pattern end to end on one entity
type — Cards — with real data, real fonts, real card art, and a real layered UI border, so the
remaining 6 entity types + story reader + search can mechanically follow the same pattern.

**Architecture:** Astro static site, sibling to `pipeline/` in the repo root. Reads
`pipeline/data/cards.json` directly via relative path at build time — no copy step for JSON.
Binary assets (fonts, resolved card art, UI chrome) are copied by a small script from the
local, gitignored `lor-assets-unzipped` source dump (and `pipeline/data/art/`) into `site/public/`
(itself gitignored, regenerated on demand) — never committed to git.

**Tech Stack:** Astro (static output), TypeScript, Vitest (for the one pure-logic module,
`src/lib/cards.ts`). No UI framework (React/Vue/etc) — plain `.astro` components, zero
client-side JS by default.

**Scope note:** This plan covers Astro scaffolding, the asset pipeline, one shared layer-stack
primitive (`LayeredFrame`, the 9-slice border technique), and the Card list + detail pages —
proving the real risk (does the actual visual system work in a browser with real assets)
end to end. The other 6 entity types, the Story reader, and search are follow-up plans that
replicate this same pattern. Dice-type-specific iconography (motion icons per Attack/Guard/
Evasion detail) is intentionally deferred — this pass uses the confirmed-real `DiceCard.png` +
`Dice_{4,6,8,12,20}.png` sprites for the die-shape visual, with behaviour type/detail/range
shown as readable text, rather than guessing at unverified per-type icon asset names.

---

## File Structure

```
site/
  package.json
  astro.config.mjs
  tsconfig.json
  .env.example
  .gitignore
  scripts/
    prepare-assets.mjs   # copies fonts, DiceCard/frame/Dice_N sprites, and resolved card art
                          # into public/ from the local source dump + pipeline/data/art
  src/
    lib/
      cards.ts            # loadCards(): Card[], diceRange(behaviour): [min, max]
    layouts/
      BaseLayout.astro
    components/
      ui/
        LayeredFrame.astro # 9-slice border-image wrapper, reusable across entity types
      cards/
        CardTile.astro      # small preview for the list page
        DiceChip.astro        # DiceCard.png + Dice_N.png + numeric range, for one behaviour
    pages/
      index.astro
      cards/
        index.astro
        [id].astro
  test/
    cards.test.ts
```

---

## Task 1: Astro project scaffolding

**Files:**
- Create: `site/package.json`
- Create: `site/astro.config.mjs`
- Create: `site/tsconfig.json`
- Create: `site/.gitignore`
- Create: `site/src/pages/index.astro`

- [ ] **Step 1: Create `site/package.json`:**

```json
{
  "name": "lor-archive-site",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "node scripts/prepare-assets.mjs && astro build",
    "preview": "astro preview",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^4.16.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create `site/astro.config.mjs`:**

```javascript
import { defineConfig } from "astro/config";

export default defineConfig({
  outDir: "./dist",
});
```

- [ ] **Step 3: Create `site/tsconfig.json`:**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@lib/*": ["src/lib/*"]
    }
  }
}
```

- [ ] **Step 4: Create `site/.gitignore`:**

```
node_modules/
dist/
public/
.env
.astro/
```

- [ ] **Step 5: Create a placeholder `site/src/pages/index.astro`** (replaced properly in Task
  8, this just makes `astro build` succeed for the scaffolding check in this task):

```astro
---
---
<html>
  <head><title>LOR Archive</title></head>
  <body><h1>LOR Archive</h1></body>
</html>
```

- [ ] **Step 6: Install and verify the build works.**

Run: `cd site && npm install`
Expected: installs cleanly, no errors.

Run: `npx astro build`
Expected: succeeds, prints something like "Complete!" and produces `site/dist/index.html`.

- [ ] **Step 7: Commit:**
```bash
git add site/package.json site/package-lock.json site/astro.config.mjs site/tsconfig.json site/.gitignore site/src/pages/index.astro
git commit -m "chore: scaffold Astro site"
```

---

## Task 2: Card data loading module

**Files:**
- Create: `site/src/lib/cards.ts`
- Create: `site/test/cards.test.ts`
- Create: `site/test/fixtures/cards_sample.json`

- [ ] **Step 1: Create the fixture** at `site/test/fixtures/cards_sample.json` (mirrors the
  real `Card` shape from `pipeline/src/types.ts`):

```json
[
  {
    "id": "100001",
    "name": "Dodge and Strike",
    "artwork": "ch1_1",
    "artworkPath": null,
    "rarity": "Common",
    "range": "Near",
    "cost": 0,
    "chapter": 1,
    "behaviours": [
      { "min": 1, "dice": 4, "type": "Def", "detail": "Evasion", "motion": "E" },
      { "min": 1, "dice": 2, "type": "Atk", "detail": "Slash", "motion": "H" }
    ]
  },
  {
    "id": "102003",
    "name": "Struggle",
    "artwork": "Yun6",
    "artworkPath": "art/102003.png",
    "rarity": "Rare",
    "range": "Far",
    "cost": 2,
    "chapter": 1,
    "behaviours": [
      { "min": 3, "dice": 6, "type": "Atk", "detail": "Penetrate", "motion": "Z" }
    ]
  }
]
```

- [ ] **Step 2: Write the failing test** at `site/test/cards.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardsFrom, diceRange } from "../src/lib/cards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, "fixtures", "cards_sample.json");

describe("loadCardsFrom", () => {
  it("loads and parses cards from a JSON file", () => {
    const cards = loadCardsFrom(fixture);
    expect(cards).toHaveLength(2);
    expect(cards[0].name).toBe("Dodge and Strike");
    expect(cards[1].artworkPath).toBe("art/102003.png");
  });
});

describe("diceRange", () => {
  it("computes the [min, max] range for a behaviour from its min and die size", () => {
    expect(diceRange({ min: 1, dice: 4, type: "Def", detail: "Evasion", motion: "E" })).toEqual([
      1, 4,
    ]);
    expect(diceRange({ min: 3, dice: 6, type: "Atk", detail: "Penetrate", motion: "Z" })).toEqual(
      [3, 8]
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails.** Run: `cd site && npx vitest run test/cards.test.ts`
  Expected: FAIL — `Cannot find module '../src/lib/cards.js'`

- [ ] **Step 4: Write the implementation** at `site/src/lib/cards.ts`:

```typescript
import { readFileSync } from "node:fs";
import path from "node:path";

export interface CardBehaviour {
  min: number;
  dice: number;
  type: string;
  detail: string;
  motion: string;
}

export interface Card {
  id: string;
  name: string;
  artwork: string;
  artworkPath: string | null;
  rarity: string;
  range: string;
  cost: number;
  chapter: number;
  behaviours: CardBehaviour[];
}

export function loadCardsFrom(filePath: string): Card[] {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Card[];
}

export function loadCards(): Card[] {
  const filePath = path.resolve(process.cwd(), "../pipeline/data/cards.json");
  return loadCardsFrom(filePath);
}

export function diceRange(behaviour: CardBehaviour): [number, number] {
  return [behaviour.min, behaviour.min + behaviour.dice - 1];
}
```

- [ ] **Step 5: Run test to verify it passes.** Run: `cd site && npx vitest run test/cards.test.ts`
  Expected: PASS (3 tests)

- [ ] **Step 6: Commit:**
```bash
git add site/src/lib/cards.ts site/test/cards.test.ts site/test/fixtures/cards_sample.json
git commit -m "feat: add card data loading module with dice range helper"
```

---

## Task 3: Asset preparation script

**Files:**
- Create: `site/.env.example`
- Create: `site/scripts/prepare-assets.mjs`

**What this copies, verified against the real source dump during design:**
- Fonts: `Arita-buriM.otf`, `Railway.otf` from `Library Of Ruina Assets/Font/`
- UI chrome: `frame.png` (9-slice border) from `Library Of Ruina Assets/Texture2D/`
- Dice visuals: `DiceCard.png` from `Texture2D/`, `Dice_4.png`/`Dice_6.png`/`Dice_8.png`/
  `Dice_12.png`/`Dice_20.png` from `Library Of Ruina Assets/Sprite/`
- Resolved card art: every file already in `pipeline/data/art/` (already resolved and copied
  by the pipeline, keyed by card ID — this script just copies the whole directory through)

- [ ] **Step 1: Create `site/.env.example`:**

```
# Root of the raw Unity asset dump (contains Font/, Sprite/, Texture2D/ subfolders)
LOR_ASSETS_ROOT=C:\Workspace\lor-assets-unzipped\Library Of Ruina Assets
```

- [ ] **Step 2: Create `site/scripts/prepare-assets.mjs`:**

```javascript
import "dotenv/config";
import { mkdirSync, copyFileSync, cpSync, existsSync } from "node:fs";
import path from "node:path";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy site/.env.example to site/.env and fill it in.`);
  }
  return value;
}

function main() {
  const assetsRoot = requireEnv("LOR_ASSETS_ROOT");
  const fontDir = path.join(assetsRoot, "Font");
  const textureDir = path.join(assetsRoot, "Texture2D");
  const spriteDir = path.join(assetsRoot, "Sprite");

  const publicDir = path.resolve(process.cwd(), "public");
  const fontOutDir = path.join(publicDir, "fonts");
  const uiOutDir = path.join(publicDir, "ui");
  const artOutDir = path.join(publicDir, "art");

  mkdirSync(fontOutDir, { recursive: true });
  mkdirSync(uiOutDir, { recursive: true });

  copyFileSync(path.join(fontDir, "Arita-buriM.otf"), path.join(fontOutDir, "Arita-buriM.otf"));
  copyFileSync(path.join(fontDir, "Railway.otf"), path.join(fontOutDir, "Railway.otf"));

  copyFileSync(path.join(textureDir, "frame.png"), path.join(uiOutDir, "frame.png"));
  copyFileSync(path.join(textureDir, "DiceCard.png"), path.join(uiOutDir, "DiceCard.png"));

  for (const size of [4, 6, 8, 12, 20]) {
    const name = `Dice_${size}.png`;
    copyFileSync(path.join(spriteDir, name), path.join(uiOutDir, name));
  }

  const pipelineArtDir = path.resolve(process.cwd(), "../pipeline/data/art");
  if (existsSync(pipelineArtDir)) {
    cpSync(pipelineArtDir, artOutDir, { recursive: true });
  } else {
    console.warn(
      `No art directory found at ${pipelineArtDir} — run the pipeline's "npm run parse" first. Continuing without card art.`
    );
  }

  console.log(`Assets prepared in ${publicDir}`);
}

main();
```

- [ ] **Step 3: Add `dotenv` dependency and a `.env` file.**

Run: `cd site && npm install dotenv`

Run:
```bash
cp .env.example .env
```
Verify `.env` contains:
```
LOR_ASSETS_ROOT=C:\Workspace\lor-assets-unzipped\Library Of Ruina Assets
```

- [ ] **Step 4: Run the script and verify output.**

Run: `cd site && node scripts/prepare-assets.mjs`
Expected: prints `Assets prepared in <path>`, no thrown errors. Verify:
- `site/public/fonts/Arita-buriM.otf` and `Railway.otf` exist
- `site/public/ui/frame.png`, `DiceCard.png`, and all 5 `Dice_*.png` files exist
- `site/public/art/` contains the same files as `pipeline/data/art/` (651 files, per the
  pipeline's last real run — run `pipeline`'s `npm run parse` first if `pipeline/data/art`
  doesn't exist yet in your checkout)

- [ ] **Step 5: Commit:**
```bash
git add site/.env.example site/scripts/prepare-assets.mjs site/package.json site/package-lock.json
git commit -m "feat: add asset preparation script for fonts, UI chrome, and card art"
```

---

## Task 4: Base layout with fonts

**Files:**
- Create: `site/src/layouts/BaseLayout.astro`

- [ ] **Step 1: Create `site/src/layouts/BaseLayout.astro`:**

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title} — LOR Archive</title>
    <style is:global>
      @font-face {
        font-family: "Arita Buri";
        src: url("/fonts/Arita-buriM.otf") format("opentype");
        font-display: swap;
      }
      @font-face {
        font-family: "Railway";
        src: url("/fonts/Railway.otf") format("opentype");
        font-display: swap;
      }

      :root {
        --color-bg: #14100f;
        --color-panel: #201a17;
        --color-text: #e8ddce;
        --color-accent: #a9282f;
        --font-display: "Arita Buri", serif;
        --font-body: "Railway", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--color-bg);
        color: var(--color-text);
        font-family: var(--font-body);
      }

      h1, h2, h3 {
        font-family: var(--font-display);
      }
    </style>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Verify the site still builds** (assets must exist from Task 3 first).

Run: `cd site && npx astro build`
Expected: succeeds (BaseLayout isn't used by any page yet, so this just confirms no syntax
errors).

- [ ] **Step 3: Commit:**
```bash
git add site/src/layouts/BaseLayout.astro
git commit -m "feat: add base layout with Arita Buri / Railway fonts"
```

---

## Task 5: LayeredFrame primitive component

**Files:**
- Create: `site/src/components/ui/LayeredFrame.astro`

**Technique, from the design spec's Visual System section:** the in-game card/panel border
(`frame.png`) is a 9-slice texture — CSS's native equivalent is `border-image`, which lets one
frame texture wrap content of any size without distortion.

- [ ] **Step 1: Create `site/src/components/ui/LayeredFrame.astro`:**

```astro
---
interface Props {
  class?: string;
}
const { class: className } = Astro.props;
---
<div class:list={["layered-frame", className]}>
  <slot />
</div>

<style>
  .layered-frame {
    border-style: solid;
    border-width: 16px;
    border-image-source: url("/ui/frame.png");
    border-image-slice: 32 fill;
    border-image-width: 16px;
    border-image-repeat: stretch;
    padding: 12px;
  }
</style>
```

- [ ] **Step 2: Verify build still succeeds.**

Run: `cd site && npx astro build`
Expected: succeeds (component isn't used by a page yet, just confirms no syntax errors).

- [ ] **Step 3: Commit:**
```bash
git add site/src/components/ui/LayeredFrame.astro
git commit -m "feat: add LayeredFrame 9-slice border component"
```

---

## Task 6: DiceChip and CardTile components

**Files:**
- Create: `site/src/components/cards/DiceChip.astro`
- Create: `site/src/components/cards/CardTile.astro`

- [ ] **Step 1: Create `site/src/components/cards/DiceChip.astro`:**

```astro
---
import type { CardBehaviour } from "../../lib/cards.js";
import { diceRange } from "../../lib/cards.js";

interface Props {
  behaviour: CardBehaviour;
}
const { behaviour } = Astro.props;
const [min, max] = diceRange(behaviour);
---
<div class="dice-chip" data-type={behaviour.type}>
  <div class="dice-chip__art">
    <img src="/ui/DiceCard.png" alt="" class="dice-chip__base" />
    <img src={`/ui/Dice_${behaviour.dice}.png`} alt="" class="dice-chip__die" />
  </div>
  <div class="dice-chip__label">
    <span class="dice-chip__range">{min}–{max}</span>
    <span class="dice-chip__detail">{behaviour.type} · {behaviour.detail}</span>
  </div>
</div>

<style>
  .dice-chip {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dice-chip__art {
    position: relative;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
  .dice-chip__base,
  .dice-chip__die {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .dice-chip__label {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
  }
  .dice-chip__range {
    font-weight: bold;
  }
  .dice-chip__detail {
    opacity: 0.75;
  }
</style>
```

- [ ] **Step 2: Create `site/src/components/cards/CardTile.astro`:**

```astro
---
import type { Card } from "../../lib/cards.js";

interface Props {
  card: Card;
}
const { card } = Astro.props;
---
<a class="card-tile" href={`/cards/${card.id}/`}>
  {
    card.artworkPath && (
      <img class="card-tile__art" src={`/${card.artworkPath}`} alt={card.name} />
    )
  }
  <div class="card-tile__body">
    <span class="card-tile__name">{card.name}</span>
    <span class="card-tile__meta">
      {card.rarity} · {card.range} · Cost {card.cost}
    </span>
  </div>
</a>

<style>
  .card-tile {
    display: block;
    color: inherit;
    text-decoration: none;
    background: var(--color-panel);
    border-radius: 4px;
    overflow: hidden;
  }
  .card-tile__art {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    display: block;
    background: #000;
  }
  .card-tile__body {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .card-tile__name {
    font-weight: bold;
  }
  .card-tile__meta {
    font-size: 0.8rem;
    opacity: 0.75;
  }
</style>
```

- [ ] **Step 3: Verify build still succeeds.**

Run: `cd site && npx astro build`
Expected: succeeds.

- [ ] **Step 4: Commit:**
```bash
git add site/src/components/cards/DiceChip.astro site/src/components/cards/CardTile.astro
git commit -m "feat: add DiceChip and CardTile components"
```

---

## Task 7: Card list and detail pages

**Files:**
- Create: `site/src/pages/cards/index.astro`
- Create: `site/src/pages/cards/[id].astro`

- [ ] **Step 1: Create `site/src/pages/cards/index.astro`:**

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import CardTile from "../../components/cards/CardTile.astro";
import { loadCards } from "../../lib/cards.js";

const cards = loadCards();
---
<BaseLayout title="Cards">
  <main class="card-list-page">
    <h1>Cards</h1>
    <p>{cards.length} cards</p>
    <div class="card-grid">
      {cards.map((card) => <CardTile card={card} />)}
    </div>
  </main>
</BaseLayout>

<style>
  .card-list-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }
</style>
```

- [ ] **Step 2: Create `site/src/pages/cards/[id].astro`:**

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import LayeredFrame from "../../components/ui/LayeredFrame.astro";
import DiceChip from "../../components/cards/DiceChip.astro";
import { loadCards } from "../../lib/cards.js";

export function getStaticPaths() {
  const cards = loadCards();
  return cards.map((card) => ({
    params: { id: card.id },
    props: { card },
  }));
}

const { card } = Astro.props;
---
<BaseLayout title={card.name}>
  <main class="card-detail-page">
    <LayeredFrame class="card-detail-frame">
      {
        card.artworkPath && (
          <img class="card-detail__art" src={`/${card.artworkPath}`} alt={card.name} />
        )
      }
      <h1>{card.name}</h1>
      <p class="card-detail__meta">
        {card.rarity} · {card.range} · Cost {card.cost} · Chapter {card.chapter}
      </p>
      <div class="card-detail__behaviours">
        {card.behaviours.map((behaviour) => <DiceChip behaviour={behaviour} />)}
      </div>
    </LayeredFrame>
  </main>
</BaseLayout>

<style>
  .card-detail-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 24px;
  }
  .card-detail__art {
    width: 100%;
    max-height: 320px;
    object-fit: contain;
    display: block;
    margin-bottom: 16px;
  }
  .card-detail__meta {
    opacity: 0.8;
  }
  .card-detail__behaviours {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }
</style>
```

- [ ] **Step 3: Build and inspect real output.**

Run: `cd site && npx astro build`
Expected: succeeds, and prints a count of generated pages matching 1641 (one per card) plus
the list page and home page.

Run (to verify real content landed, not placeholders):
```bash
grep -o "<h1>[^<]*</h1>" dist/cards/100001/index.html
```
Expected: something like `<h1>Dodge and Strike</h1>` (or whatever card ID `100001` resolves
to in the real data) — confirms real card data flowed all the way through `getStaticPaths` into
the rendered HTML.

- [ ] **Step 4: Commit:**
```bash
git add site/src/pages/cards/
git commit -m "feat: add card list and detail pages"
```

---

## Task 8: Home page and manual visual verification

**Files:**
- Modify: `site/src/pages/index.astro`

- [ ] **Step 1: Replace the placeholder home page:**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout title="Library">
  <main class="home-page">
    <h1>Library of Ruina Archive</h1>
    <p>An unofficial archive of Library of Ruina's game data.</p>
    <nav>
      <a href="/cards/">Cards</a>
    </nav>
  </main>
</BaseLayout>

<style>
  .home-page {
    max-width: 800px;
    margin: 80px auto;
    padding: 24px;
    text-align: center;
  }
  nav a {
    color: var(--color-accent);
    font-size: 1.2rem;
  }
</style>
```

- [ ] **Step 2: Run the dev server and visually verify in a browser** (this step is manual,
  not scriptable — per the project's UI-verification practice, don't just trust a successful
  build).

Run: `cd site && npx astro dev`

Open `http://localhost:4321/` in a browser and confirm:
- The Arita Buri font renders on headings (visually distinct serif/display style, not a
  fallback font)
- Navigate to `/cards/` — the grid shows real card names/rarities, and cards with resolved
  art show real card artwork images (not broken image icons)
- Click into a card with resolved art (e.g. one of the 651 real `artworkPath` entries) —
  confirm the `LayeredFrame` border renders around the content (a visible textured border,
  not a plain CSS box), and the `DiceChip` components show the die-shape image with a
  correct numeric range
- Click into a card WITHOUT resolved art — confirm it degrades gracefully (no broken image
  icon, just no art shown)

Stop the dev server once verified (Ctrl+C).

- [ ] **Step 3: Run the full test suite one more time.**

Run: `cd site && npm test`
Expected: PASS (3 tests, from Task 2)

- [ ] **Step 4: Commit:**
```bash
git add site/src/pages/index.astro
git commit -m "feat: add home page"
```

---

## Self-Review Notes

- **Spec coverage**: implements the "Routes" (`/`, `/cards/`, `/cards/[id]/`), "Data flow",
  "Asset flow", "Component structure" (one primitive, `LayeredFrame`), and "Stack" sections of
  the design spec's Site Architecture, scoped to Cards only as the proof-of-pattern slice —
  explicitly named as a deliberate boundary in the Goal/Scope note, not a gap. KeyPages,
  Enemies, Passives, Stages, Abnormality codex, the Story reader, and search are named as
  follow-up plans there.
- **Placeholder scan**: no TBD/TODO language; every step has literal code, exact commands, or
  (Task 8 Step 2) an explicit, itemized manual verification checklist rather than a vague
  "verify it looks right."
- **Type consistency**: `Card`/`CardBehaviour` in `site/src/lib/cards.ts` (Task 2) match the
  shape produced by `pipeline/src/parseCards.ts` field-for-field (verified against the pipeline
  plan's own `Card` type), and are used consistently across `DiceChip.astro`, `CardTile.astro`,
  and both page components (Tasks 6–7).
