# Data Pipeline Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core parsing pipeline that reads raw Library of Ruina XML data, joins it
against its English localization, resolves art references, and emits clean JSON — proven end
to end on three representative entity types (Cards, Key Pages, Enemies).

**Architecture:** A standalone Node/TypeScript package (`pipeline/`) with one parser module per
entity type, a shared XML-reading helper, a shared localization-loading pattern, and an art
resolver that indexes the raw Unity sprite/texture dump by filename. An orchestrator script
runs all parsers against the real source data and writes JSON + copies matched art into
`data/`. Every parser is unit-tested against small hand-written XML fixtures that mirror the
real files byte-for-byte in structure.

**Tech Stack:** Node.js, TypeScript, `fast-xml-parser` (XML→JS), `vitest` (test runner), no
framework — this package has no dependency on the site (Astro) build.

**Scope note:** This plan covers the pipeline's foundation and three entity types (Card,
KeyPage, Enemy) — enough to prove the full pattern (parse → localize → cross-reference →
resolve art → emit) end to end on real data. Abnormality, Passive, Stage, and Story parsers
follow the identical pattern established here and are a separate follow-up plan. The Astro
site that consumes this pipeline's JSON output is also a separate follow-up plan.

---

## File Structure

```
pipeline/
  package.json
  tsconfig.json
  .env.example
  src/
    config.ts            # resolves source data root paths from env
    xml.ts                # readXml() + toArray() helpers
    types.ts              # Card, KeyPage, Enemy, and shared sub-types
    localization.ts       # loadCardLocalization(), loadBookLocalization(), loadNameMap()
    parseCards.ts          # parseCardFile()
    parseKeyPages.ts        # parseKeyPageFile()
    parseEnemies.ts          # parseEnemyFile()
    resolveArt.ts             # buildArtIndex(), resolveArtPath()
    index.ts                   # orchestrator: parse all ch1 sources, write data/*.json + art
  test/
    fixtures/
      CardInfo_sample.txt
      EN_BattleCards_sample.txt
      EquipPage_sample.txt
      EN_Books_sample.txt
      EnemyUnitInfo_sample.txt
      EN_CharactersName_sample.txt
    xml.test.ts
    localization.test.ts
    parseCards.test.ts
    parseKeyPages.test.ts
    parseEnemies.test.ts
    resolveArt.test.ts
```

---

## Task 1: Project scaffolding

**Files:**
- Create: `pipeline/package.json`
- Create: `pipeline/tsconfig.json`
- Create: `pipeline/.env.example`
- Create: `pipeline/.gitignore`

- [ ] **Step 1: Create the pipeline package directory and `package.json`**

```json
{
  "name": "lor-archive-pipeline",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "parse": "tsc && node dist/index.js"
  },
  "dependencies": {
    "fast-xml-parser": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create `pipeline/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `pipeline/.env.example`**

```
# Root of the "Library of Ruina - Organized Assets/Text" folder
# (contains structural XML at the root + English/ subfolder with EN_*.txt)
LOR_TEXT_ROOT=C:\Workspace\lor-assets-unzipped\Library of Ruina - Organized Assets\Text

# Roots of the raw Unity asset dump used for art lookup (checked in this order)
LOR_ART_ROOTS=C:\Workspace\lor-assets-unzipped\Library Of Ruina Assets\Texture2D,C:\Workspace\lor-assets-unzipped\Library Of Ruina Assets\Sprite
```

- [ ] **Step 4: Create `pipeline/.gitignore`**

```
node_modules/
dist/
.env
data/
```

- [ ] **Step 5: Install dependencies**

Run: `cd pipeline && npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 6: Commit**

```bash
git add pipeline/package.json pipeline/package-lock.json pipeline/tsconfig.json pipeline/.env.example pipeline/.gitignore
git commit -m "chore: scaffold pipeline package"
```

---

## Task 2: Shared types

**Files:**
- Create: `pipeline/src/types.ts`

- [ ] **Step 1: Write the types module**

```typescript
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

export interface KeyPageDesc {
  paragraphs: string[];
}

export interface KeyPageEquipEffect {
  hp: number;
  breakStat: number;
  speedMin: number;
  speed: number;
  sResist: string;
  pResist: string;
  hResist: string;
}

export interface KeyPage {
  id: string;
  name: string;
  desc: KeyPageEquipEffect | null;
  paragraphs: string[];
  bookIcon: string;
  rarity: string;
  chapter: number;
  characterSkin: string;
}

export interface Enemy {
  id: string;
  name: string;
  bookId: string;
  deckId: string;
  minHeight: number;
  maxHeight: number;
  exp: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/src/types.ts
git commit -m "feat: add shared pipeline types"
```

---

## Task 3: XML read helper

**Files:**
- Create: `pipeline/src/xml.ts`
- Create: `pipeline/test/xml.test.ts`
- Create: `pipeline/test/fixtures/CardInfo_sample.txt`

- [ ] **Step 1: Create the fixture used by this and later tests**

```xml
<?xml version="1.0" encoding="utf-8"?>
<DiceCardXmlRoot xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Card ID="100001">
    <Name>흘려치기</Name>
    <Artwork>ch1_1</Artwork>
    <Rarity>Common</Rarity>
    <Spec Range="Near" Cost="0" />
    <Script />
    <ScriptDesc />
    <BehaviourList>
      <Behaviour Min="1" Dice="4" Type="Def" Detail="Evasion" Motion="E" EffectRes="" Script="" Desc="" />
      <Behaviour Min="1" Dice="2" Type="Atk" Detail="Slash" Motion="H" EffectRes="ch1_H" Script="" Desc="" />
    </BehaviourList>
    <Chapter>1</Chapter>
    <Priority>0</Priority>
  </Card>
  <Card ID="100002">
    <Name>찌르기</Name>
    <Artwork>ch1_2</Artwork>
    <Rarity>Common</Rarity>
    <Spec Range="Near" Cost="1" />
    <Script />
    <ScriptDesc />
    <BehaviourList>
      <Behaviour Min="1" Dice="4" Type="Atk" Detail="Penetrate" Motion="Z" EffectRes="ch1_Z" Script="" Desc="" />
    </BehaviourList>
    <Chapter>1</Chapter>
    <Priority>0</Priority>
  </Card>
</DiceCardXmlRoot>
```

Save this to `pipeline/test/fixtures/CardInfo_sample.txt`.

- [ ] **Step 2: Write the failing test**

```typescript
// pipeline/test/xml.test.ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readXml, toArray } from "../src/xml.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, "fixtures", "CardInfo_sample.txt");

describe("readXml", () => {
  it("parses an XML file into a JS object with attribute access", () => {
    const doc = readXml(fixture);
    const cards = toArray(doc.DiceCardXmlRoot.Card);
    expect(cards).toHaveLength(2);
    expect(cards[0]["@_ID"]).toBe("100001");
    expect(cards[0].Name).toBe("흘려치기");
  });
});

describe("toArray", () => {
  it("wraps a single object in an array", () => {
    expect(toArray({ a: 1 })).toEqual([{ a: 1 }]);
  });

  it("passes an existing array through unchanged", () => {
    expect(toArray([{ a: 1 }, { a: 2 }])).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("returns an empty array for undefined", () => {
    expect(toArray(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd pipeline && npx vitest run test/xml.test.ts`
Expected: FAIL — `Cannot find module '../src/xml.js'`

- [ ] **Step 4: Write the implementation**

```typescript
// pipeline/src/xml.ts
import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export function readXml(filePath: string): any {
  const raw = readFileSync(filePath, "utf-8");
  return parser.parse(raw);
}

export function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd pipeline && npx vitest run test/xml.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/xml.ts pipeline/test/xml.test.ts pipeline/test/fixtures/CardInfo_sample.txt
git commit -m "feat: add XML read helper with toArray normalization"
```

---

## Task 4: Localization loaders

**Files:**
- Create: `pipeline/src/localization.ts`
- Create: `pipeline/test/localization.test.ts`
- Create: `pipeline/test/fixtures/EN_BattleCards_sample.txt`
- Create: `pipeline/test/fixtures/EN_Books_sample.txt`
- Create: `pipeline/test/fixtures/EN_CharactersName_sample.txt`

- [ ] **Step 1: Create the fixtures**

```xml
<!-- pipeline/test/fixtures/EN_BattleCards_sample.txt -->
<?xml version="1.0" encoding="utf-8"?>
<BattleCardDescRoot xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <cardDescList>
    <BattleCardDesc ID="100001">
      <LocalizedName>Flowing Strike</LocalizedName>
      <Ability />
    </BattleCardDesc>
    <BattleCardDesc ID="100002">
      <LocalizedName>Stab</LocalizedName>
      <Ability />
    </BattleCardDesc>
  </cardDescList>
</BattleCardDescRoot>
```

```xml
<!-- pipeline/test/fixtures/EN_Books_sample.txt -->
<?xml version="1.0" encoding="utf-8"?>
<BookDescRoot xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <bookDescList>
    <BookDesc BookID="200001">
      <BookName>Lenny's Page</BookName>
      <TextList>
        <Desc>Wanna hear a secret?</Desc>
        <Desc>Back when I was a young kid, I didn't like that.</Desc>
      </TextList>
      <PassiveList />
    </BookDesc>
  </bookDescList>
</BookDescRoot>
```

```xml
<!-- pipeline/test/fixtures/EN_CharactersName_sample.txt -->
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<CharactersNameRoot xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name ID="11">Mang-chi</Name>
  <Name ID="12">Lenny</Name>
  <Name ID="13">Pete</Name>
</CharactersNameRoot>
```

- [ ] **Step 2: Write the failing test**

```typescript
// pipeline/test/localization.test.ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCardLocalization,
  loadBookLocalization,
  loadNameMap,
} from "../src/localization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("loadCardLocalization", () => {
  it("maps card ID to its localized name", () => {
    const map = loadCardLocalization(path.join(fixtures, "EN_BattleCards_sample.txt"));
    expect(map.get("100001")).toBe("Flowing Strike");
    expect(map.get("100002")).toBe("Stab");
  });
});

describe("loadBookLocalization", () => {
  it("maps book ID to its name and paragraph list", () => {
    const map = loadBookLocalization(path.join(fixtures, "EN_Books_sample.txt"));
    const entry = map.get("200001");
    expect(entry?.name).toBe("Lenny's Page");
    expect(entry?.paragraphs).toEqual([
      "Wanna hear a secret?",
      "Back when I was a young kid, I didn't like that.",
    ]);
  });
});

describe("loadNameMap", () => {
  it("maps numeric character ID to its localized name", () => {
    const map = loadNameMap(path.join(fixtures, "EN_CharactersName_sample.txt"));
    expect(map.get("12")).toBe("Lenny");
    expect(map.get("13")).toBe("Pete");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd pipeline && npx vitest run test/localization.test.ts`
Expected: FAIL — `Cannot find module '../src/localization.js'`

- [ ] **Step 4: Write the implementation**

```typescript
// pipeline/src/localization.ts
import { readXml, toArray } from "./xml.js";

export function loadCardLocalization(filePath: string): Map<string, string> {
  const doc = readXml(filePath);
  const entries = toArray(doc.BattleCardDescRoot?.cardDescList?.BattleCardDesc);
  const map = new Map<string, string>();
  for (const entry of entries) {
    const id = String(entry["@_ID"]);
    const name = typeof entry.LocalizedName === "string" ? entry.LocalizedName : "";
    map.set(id, name);
  }
  return map;
}

export interface BookLocalization {
  name: string;
  paragraphs: string[];
}

export function loadBookLocalization(filePath: string): Map<string, BookLocalization> {
  const doc = readXml(filePath);
  const entries = toArray(doc.BookDescRoot?.bookDescList?.BookDesc);
  const map = new Map<string, BookLocalization>();
  for (const entry of entries) {
    const id = String(entry["@_BookID"]);
    const name = typeof entry.BookName === "string" ? entry.BookName : "";
    const paragraphs = toArray<string>(entry.TextList?.Desc).filter(
      (p): p is string => typeof p === "string"
    );
    map.set(id, { name, paragraphs });
  }
  return map;
}

export function loadNameMap(filePath: string): Map<string, string> {
  const doc = readXml(filePath);
  const entries = toArray(doc.CharactersNameRoot?.Name);
  const map = new Map<string, string>();
  for (const entry of entries) {
    const id = String(entry["@_ID"]);
    const name = typeof entry["#text"] === "string" ? entry["#text"] : String(entry ?? "");
    map.set(id, name);
  }
  return map;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd pipeline && npx vitest run test/localization.test.ts`
Expected: PASS (3 tests). If `loadNameMap` fails because `fast-xml-parser` returns a plain
string (not `{"#text": ...}`) for a leaf element with only an attribute and text, adjust the
name extraction to `String(entry)` for that case — `fast-xml-parser` only wraps text in
`#text` when the element has both attributes and child content; check the actual shape by
temporarily logging `entries[0]` if the assertion fails.

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/localization.ts pipeline/test/localization.test.ts pipeline/test/fixtures/EN_BattleCards_sample.txt pipeline/test/fixtures/EN_Books_sample.txt pipeline/test/fixtures/EN_CharactersName_sample.txt
git commit -m "feat: add localization loaders for cards, books, and character names"
```

---

## Task 5: Card parser

**Files:**
- Create: `pipeline/src/parseCards.ts`
- Create: `pipeline/test/parseCards.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// pipeline/test/parseCards.test.ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCardFile } from "../src/parseCards.js";
import { loadCardLocalization } from "../src/localization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parseCardFile", () => {
  it("parses cards and prefers the localized English name", () => {
    const localization = loadCardLocalization(
      path.join(fixtures, "EN_BattleCards_sample.txt")
    );
    const cards = parseCardFile(path.join(fixtures, "CardInfo_sample.txt"), localization);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      id: "100001",
      name: "Flowing Strike",
      artwork: "ch1_1",
      artworkPath: null,
      rarity: "Common",
      range: "Near",
      cost: 0,
      chapter: 1,
      behaviours: [
        { min: 1, dice: 4, type: "Def", detail: "Evasion", motion: "E" },
        { min: 1, dice: 2, type: "Atk", detail: "Slash", motion: "H" },
      ],
    });
  });

  it("falls back to the raw Korean name when no localization entry exists", () => {
    const cards = parseCardFile(
      path.join(fixtures, "CardInfo_sample.txt"),
      new Map()
    );
    expect(cards[0].name).toBe("흘려치기");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run test/parseCards.test.ts`
Expected: FAIL — `Cannot find module '../src/parseCards.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// pipeline/src/parseCards.ts
import { readXml, toArray } from "./xml.js";
import type { Card, CardBehaviour } from "./types.js";

export function parseCardFile(filePath: string, localization: Map<string, string>): Card[] {
  const doc = readXml(filePath);
  const cardNodes = toArray<any>(doc.DiceCardXmlRoot?.Card);

  return cardNodes.map((node): Card => {
    const id = String(node["@_ID"]);
    const behaviourNodes = toArray<any>(node.BehaviourList?.Behaviour);
    const behaviours: CardBehaviour[] = behaviourNodes.map((b) => ({
      min: Number(b["@_Min"]),
      dice: Number(b["@_Dice"]),
      type: String(b["@_Type"]),
      detail: String(b["@_Detail"]),
      motion: String(b["@_Motion"]),
    }));

    return {
      id,
      name: localization.get(id) || String(node.Name ?? ""),
      artwork: String(node.Artwork ?? ""),
      artworkPath: null,
      rarity: String(node.Rarity ?? ""),
      range: String(node.Spec?.["@_Range"] ?? ""),
      cost: Number(node.Spec?.["@_Cost"] ?? 0),
      chapter: Number(node.Chapter ?? 0),
      behaviours,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run test/parseCards.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/parseCards.ts pipeline/test/parseCards.test.ts
git commit -m "feat: add card parser with English localization join"
```

---

## Task 6: Key page parser

**Files:**
- Create: `pipeline/src/parseKeyPages.ts`
- Create: `pipeline/test/parseKeyPages.test.ts`
- Create: `pipeline/test/fixtures/EquipPage_sample.txt`

- [ ] **Step 1: Create the fixture**

```xml
<!-- pipeline/test/fixtures/EquipPage_sample.txt -->
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<BookXmlRoot xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
	<Book ID="200001">
		<Name>레니</Name>
		<TextId>200001</TextId>
		<EquipEffect>
      <HP>42</HP>
      <Break>22</Break>
			<SpeedMin>1</SpeedMin>
			<Speed>4</Speed>
			<SResist>Normal</SResist>
			<PResist>Vulnerable</PResist>
			<HResist>Weak</HResist>
			<SBResist>Normal</SBResist>
			<PBResist>Vulnerable</PBResist>
			<HBResist>Weak</HBResist>
		</EquipEffect>
		<BookIcon>Rats</BookIcon>
		<Rarity>Common</Rarity>
		<Chapter>1</Chapter>
		<Episode>2</Episode>
		<CharacterSkin>Lenny</CharacterSkin>
	</Book>
</BookXmlRoot>
```

- [ ] **Step 2: Write the failing test**

```typescript
// pipeline/test/parseKeyPages.test.ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseKeyPageFile } from "../src/parseKeyPages.js";
import { loadBookLocalization } from "../src/localization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parseKeyPageFile", () => {
  it("parses stats and joins the English name/description", () => {
    const localization = loadBookLocalization(path.join(fixtures, "EN_Books_sample.txt"));
    const pages = parseKeyPageFile(path.join(fixtures, "EquipPage_sample.txt"), localization);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual({
      id: "200001",
      name: "Lenny's Page",
      desc: {
        hp: 42,
        breakStat: 22,
        speedMin: 1,
        speed: 4,
        sResist: "Normal",
        pResist: "Vulnerable",
        hResist: "Weak",
      },
      paragraphs: [
        "Wanna hear a secret?",
        "Back when I was a young kid, I didn't like that.",
      ],
      bookIcon: "Rats",
      rarity: "Common",
      chapter: 1,
      characterSkin: "Lenny",
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd pipeline && npx vitest run test/parseKeyPages.test.ts`
Expected: FAIL — `Cannot find module '../src/parseKeyPages.js'`

- [ ] **Step 4: Write the implementation**

```typescript
// pipeline/src/parseKeyPages.ts
import { readXml, toArray } from "./xml.js";
import type { KeyPage } from "./types.js";
import type { BookLocalization } from "./localization.js";

export function parseKeyPageFile(
  filePath: string,
  localization: Map<string, BookLocalization>
): KeyPage[] {
  const doc = readXml(filePath);
  const bookNodes = toArray<any>(doc.BookXmlRoot?.Book);

  return bookNodes.map((node): KeyPage => {
    const id = String(node["@_ID"]);
    const loc = localization.get(id);
    const effect = node.EquipEffect ?? {};

    return {
      id,
      name: loc?.name || String(node.Name ?? ""),
      desc: {
        hp: Number(effect.HP ?? 0),
        breakStat: Number(effect.Break ?? 0),
        speedMin: Number(effect.SpeedMin ?? 0),
        speed: Number(effect.Speed ?? 0),
        sResist: String(effect.SResist ?? ""),
        pResist: String(effect.PResist ?? ""),
        hResist: String(effect.HResist ?? ""),
      },
      paragraphs: loc?.paragraphs ?? [],
      bookIcon: String(node.BookIcon ?? ""),
      rarity: String(node.Rarity ?? ""),
      chapter: Number(node.Chapter ?? 0),
      characterSkin: String(node.CharacterSkin ?? ""),
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd pipeline && npx vitest run test/parseKeyPages.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/parseKeyPages.ts pipeline/test/parseKeyPages.test.ts pipeline/test/fixtures/EquipPage_sample.txt
git commit -m "feat: add key page parser with English localization join"
```

---

## Task 7: Enemy parser

**Files:**
- Create: `pipeline/src/parseEnemies.ts`
- Create: `pipeline/test/parseEnemies.test.ts`
- Create: `pipeline/test/fixtures/EnemyUnitInfo_sample.txt`

- [ ] **Step 1: Create the fixture**

```xml
<!-- pipeline/test/fixtures/EnemyUnitInfo_sample.txt -->
<?xml version="1.0" encoding="utf-8" ?>
<EnemyUnitClassRoot>
  <Enemy ID="1">
    <NameID>12</NameID>
    <MinHeight>165</MinHeight>
    <MaxHeight>165</MaxHeight>
    <BookId>200001</BookId>
    <DeckId>100001</DeckId>
    <Exp>2</Exp>
    <DropTable Level="0">
      <DropItem Prob="3">200001</DropItem>
    </DropTable>
  </Enemy>
  <Enemy ID="2">
    <NameID>13</NameID>
    <MinHeight>170</MinHeight>
    <MaxHeight>170</MaxHeight>
    <BookId>200002</BookId>
    <DeckId>100002</DeckId>
    <Exp>2</Exp>
    <DropTable Level="0">
      <DropItem Prob="3">200001</DropItem>
    </DropTable>
  </Enemy>
</EnemyUnitClassRoot>
```

- [ ] **Step 2: Write the failing test**

```typescript
// pipeline/test/parseEnemies.test.ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnemyFile } from "../src/parseEnemies.js";
import { loadNameMap } from "../src/localization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parseEnemyFile", () => {
  it("parses enemies and resolves their name via NameID", () => {
    const names = loadNameMap(path.join(fixtures, "EN_CharactersName_sample.txt"));
    const enemies = parseEnemyFile(
      path.join(fixtures, "EnemyUnitInfo_sample.txt"),
      names
    );

    expect(enemies).toHaveLength(2);
    expect(enemies[0]).toEqual({
      id: "1",
      name: "Lenny",
      bookId: "200001",
      deckId: "100001",
      minHeight: 165,
      maxHeight: 165,
      exp: 2,
    });
    expect(enemies[1].name).toBe("Pete");
  });

  it("falls back to a placeholder name when NameID has no match", () => {
    const enemies = parseEnemyFile(
      path.join(fixtures, "EnemyUnitInfo_sample.txt"),
      new Map()
    );
    expect(enemies[0].name).toBe("Unknown (NameID 12)");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd pipeline && npx vitest run test/parseEnemies.test.ts`
Expected: FAIL — `Cannot find module '../src/parseEnemies.js'`

- [ ] **Step 4: Write the implementation**

```typescript
// pipeline/src/parseEnemies.ts
import { readXml, toArray } from "./xml.js";
import type { Enemy } from "./types.js";

export function parseEnemyFile(filePath: string, names: Map<string, string>): Enemy[] {
  const doc = readXml(filePath);
  const enemyNodes = toArray<any>(doc.EnemyUnitClassRoot?.Enemy);

  return enemyNodes.map((node): Enemy => {
    const nameId = String(node.NameID ?? "");
    const name = names.get(nameId) ?? `Unknown (NameID ${nameId})`;

    return {
      id: String(node["@_ID"]),
      name,
      bookId: String(node.BookId ?? ""),
      deckId: String(node.DeckId ?? ""),
      minHeight: Number(node.MinHeight ?? 0),
      maxHeight: Number(node.MaxHeight ?? 0),
      exp: Number(node.Exp ?? 0),
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd pipeline && npx vitest run test/parseEnemies.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/parseEnemies.ts pipeline/test/parseEnemies.test.ts pipeline/test/fixtures/EnemyUnitInfo_sample.txt
git commit -m "feat: add enemy parser with name resolution"
```

---

## Task 8: Art resolver

**Files:**
- Create: `pipeline/src/resolveArt.ts`
- Create: `pipeline/test/resolveArt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// pipeline/test/resolveArt.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildArtIndex, resolveArtPath } from "../src/resolveArt.js";

let root1: string;
let root2: string;

beforeAll(() => {
  root1 = mkdtempSync(path.join(tmpdir(), "lor-art-1-"));
  root2 = mkdtempSync(path.join(tmpdir(), "lor-art-2-"));
  writeFileSync(path.join(root1, "ch1_1.png"), "fake-png-bytes");
  writeFileSync(path.join(root2, "ch1_2.png"), "fake-png-bytes");
});

afterAll(() => {
  rmSync(root1, { recursive: true, force: true });
  rmSync(root2, { recursive: true, force: true });
});

describe("buildArtIndex / resolveArtPath", () => {
  it("finds a file by its name (without extension) across multiple roots", () => {
    const index = buildArtIndex([root1, root2]);
    expect(resolveArtPath(index, "ch1_1")).toBe(path.join(root1, "ch1_1.png"));
    expect(resolveArtPath(index, "ch1_2")).toBe(path.join(root2, "ch1_2.png"));
  });

  it("returns null when no matching file exists", () => {
    const index = buildArtIndex([root1, root2]);
    expect(resolveArtPath(index, "does_not_exist")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && npx vitest run test/resolveArt.test.ts`
Expected: FAIL — `Cannot find module '../src/resolveArt.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// pipeline/src/resolveArt.ts
import { readdirSync } from "node:fs";
import path from "node:path";

export type ArtIndex = Map<string, string>;

export function buildArtIndex(roots: string[]): ArtIndex {
  const index: ArtIndex = new Map();
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const stem = path.parse(entry).name;
      if (!index.has(stem)) {
        index.set(stem, path.join(root, entry));
      }
    }
  }
  return index;
}

export function resolveArtPath(index: ArtIndex, assetName: string): string | null {
  return index.get(assetName) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pipeline && npx vitest run test/resolveArt.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/resolveArt.ts pipeline/test/resolveArt.test.ts
git commit -m "feat: add art index resolver for raw sprite/texture dump"
```

---

## Task 9: Config and orchestrator

**Files:**
- Create: `pipeline/src/config.ts`
- Create: `pipeline/src/index.ts`

- [ ] **Step 1: Write the config module**

```typescript
// pipeline/src/config.ts
export interface PipelineConfig {
  textRoot: string;
  artRoots: string[];
}

export function loadConfig(): PipelineConfig {
  const textRoot = process.env.LOR_TEXT_ROOT;
  const artRootsRaw = process.env.LOR_ART_ROOTS;

  if (!textRoot) {
    throw new Error("LOR_TEXT_ROOT is not set. Copy pipeline/.env.example to pipeline/.env and fill in your local paths.");
  }
  if (!artRootsRaw) {
    throw new Error("LOR_ART_ROOTS is not set. Copy pipeline/.env.example to pipeline/.env and fill in your local paths.");
  }

  return {
    textRoot,
    artRoots: artRootsRaw.split(",").map((p) => p.trim()),
  };
}
```

- [ ] **Step 2: Write the orchestrator**

```typescript
// pipeline/src/index.ts
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { loadCardLocalization, loadBookLocalization, loadNameMap } from "./localization.js";
import { parseCardFile } from "./parseCards.js";
import { parseKeyPageFile } from "./parseKeyPages.js";
import { parseEnemyFile } from "./parseEnemies.js";
import { buildArtIndex, resolveArtPath } from "./resolveArt.js";

function main(): void {
  const config = loadConfig();
  const outDir = path.resolve("data");
  const artOutDir = path.join(outDir, "art");
  mkdirSync(artOutDir, { recursive: true });

  const en = (name: string) => path.join(config.textRoot, "English", name);
  const kr = (name: string) => path.join(config.textRoot, name);

  const cardLocalization = loadCardLocalization(en("EN_BattleCards.txt"));
  const bookLocalization = loadBookLocalization(en("EN_Books.txt"));
  const names = loadNameMap(en("EN_CharactersName.txt"));

  const cards = parseCardFile(kr("CardInfo_ch1.txt"), cardLocalization);
  const keyPages = parseKeyPageFile(kr("EquipPage_ch1.txt"), bookLocalization);
  const enemies = parseEnemyFile(kr("EnemyUnitInfo.txt"), names);

  const artIndex = buildArtIndex(config.artRoots);
  for (const card of cards) {
    const source = resolveArtPath(artIndex, card.artwork);
    if (source) {
      const destName = `${card.id}${path.extname(source)}`;
      copyFileSync(source, path.join(artOutDir, destName));
      card.artworkPath = `art/${destName}`;
    }
  }

  writeFileSync(path.join(outDir, "cards.json"), JSON.stringify(cards, null, 2));
  writeFileSync(path.join(outDir, "keypages.json"), JSON.stringify(keyPages, null, 2));
  writeFileSync(path.join(outDir, "enemies.json"), JSON.stringify(enemies, null, 2));

  console.log(`Wrote ${cards.length} cards, ${keyPages.length} key pages, ${enemies.length} enemies to ${outDir}`);
}

main();
```

- [ ] **Step 3: Create a local `.env` from the example and fill in real paths**

Run (adjust if your paths differ from the earlier verification):
```bash
cd pipeline
cp .env.example .env
```
Verify `.env` contains:
```
LOR_TEXT_ROOT=C:\Workspace\lor-assets-unzipped\Library of Ruina - Organized Assets\Text
LOR_ART_ROOTS=C:\Workspace\lor-assets-unzipped\Library Of Ruina Assets\Texture2D,C:\Workspace\lor-assets-unzipped\Library Of Ruina Assets\Sprite
```

- [ ] **Step 4: Add a way to load `.env` and run the orchestrator against real data**

Install dotenv:
Run: `cd pipeline && npm install dotenv`

Add the import as the very first line of `pipeline/src/index.ts`, above the existing
`import { mkdirSync, ... } from "node:fs";` line:

```typescript
import "dotenv/config";
```

- [ ] **Step 5: Build and run against real data**

Run: `cd pipeline && npm run parse`
Expected: Console prints `Wrote 55 cards, 1 key pages, ...` (exact counts depend on
`CardInfo_ch1.txt`'s real content — nonzero counts and no thrown errors is the pass
condition). Verify `pipeline/data/cards.json` exists and its first entry has a non-Korean
`name` field and a non-null `artworkPath`.

If `enemies.json`'s first entry's `bookId`/`deckId` don't match any `cards.json`/real key
page ID, that's expected here — `EnemyUnitInfo.txt` covers all chapters while this task only
parses `CardInfo_ch1.txt`/`EquipPage_ch1.txt`; cross-chapter linking is handled once the
remaining chapter files are wired in (follow-up plan), not required for this task's pass
condition.

- [ ] **Step 6: Commit**

```bash
git add pipeline/src/config.ts pipeline/src/index.ts pipeline/package.json pipeline/package-lock.json
git commit -m "feat: add pipeline orchestrator wiring cards, key pages, and enemies end to end"
```

---

## Task 10: Document how to run the pipeline

**Files:**
- Create: `pipeline/README.md`

- [ ] **Step 1: Write the README**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add pipeline/README.md
git commit -m "docs: add pipeline setup and usage instructions"
```

---

## Self-Review Notes

- **Spec coverage**: This plan implements the "Pipeline" and part of the "Data Model" sections
  of the design spec for three entity types (Card, KeyPage, Enemy), proving the parse→localize→
  cross-reference→resolve-art→emit pattern end to end. Abnormality, Passive, Stage, Story, and
  the Astro site are explicitly out of scope here — see the "Scope note" at the top and the
  README's "Status" section, both of which name this as a deliberate boundary, not a gap.
- **Placeholder scan**: no TBD/TODO/"handle appropriately" language; every step has literal
  code or an exact command with an expected result.
- **Type consistency**: `Card`, `KeyPage`, `Enemy` in `types.ts` (Task 2) match the object
  shapes asserted in `parseCards.test.ts`, `parseKeyPages.test.ts`, `parseEnemies.test.ts`
  (Tasks 5–7) and the fields written by `index.ts` (Task 9) field-for-field.
