# Data Pipeline Full Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing data pipeline (`pipeline/`) from "Chapter 1 Cards/KeyPages/Enemies
only" to full coverage: every chapter and boss for Card/KeyPage, new parsers for Deck/Passive/
Stage/Story/AbnormalityCodex, and a fix so `Enemy.deckId` resolves to an actual card list.

**Architecture:** Same pattern as the existing pipeline (`readXml` → `toArray` → typed record,
joined to English localization by ID). Two new pieces make full coverage tractable without
hand-typing dozens of file-pairing mistakes: a **localization resolver** that finds the correct
`EN_BattleCards*.txt`/`EN_PassiveDesc*.txt` file for a given structural file by counting real ID
overlap (not guessing from filenames — filenames are inconsistent, e.g. `FinalBand` vs
`BandFinal`), and a **file discovery** step that globs structural files by prefix instead of
hand-listing them.

**Tech Stack:** Same as existing pipeline — Node.js, TypeScript, `fast-xml-parser`, `vitest`.
No new dependencies except Node's built-in `node:fs` glob-equivalent (`readdirSync` + filter).

**Grounding note:** every file family and schema referenced below was read directly from the
real source data during design (not assumed from naming conventions) — see
`docs/superpowers/specs/2026-08-02-lor-archive-design.md` for the full record of what was
verified and why. In particular: `Chapter_X_Y_Z.txt` files contain no dialogue text (verified by
reading one in full) — the real story text is in the separate, self-contained
`EN_Chapter{N}.txt` family, which is what this plan's Story parser targets.

---

## File Structure

```
pipeline/src/
  resolveLocalization.ts   # NEW: pickBestLocalizationFile() - ID-overlap-based file resolver
  discoverFiles.ts          # NEW: listFilesByPrefix() - glob structural files by prefix
  parseDecks.ts              # NEW: parseDeckFile()
  parsePassives.ts            # NEW: parsePassiveFile()
  parseStages.ts                # NEW: parseStageFile()
  parseStory.ts                   # NEW: parseStoryFile()
  parseAbnormalityCodex.ts          # NEW: parseAbnormalityCodexFile()
  index.ts                           # REWRITTEN: full-coverage orchestrator
  # unchanged: types.ts, xml.ts, localization.ts, parseCards.ts, parseKeyPages.ts,
  #            parseEnemies.ts, resolveArt.ts, config.ts
pipeline/test/
  resolveLocalization.test.ts
  discoverFiles.test.ts
  parseDecks.test.ts
  parsePassives.test.ts
  parseStages.test.ts
  parseStory.test.ts
  parseAbnormalityCodex.test.ts
  fixtures/
    # new fixtures per task below, plus reuse of existing fixtures where noted
```

---

## Task 1: Localization file resolver

**Files:**
- Create: `pipeline/src/resolveLocalization.ts`
- Create: `pipeline/test/resolveLocalization.test.ts`
- Create: `pipeline/test/fixtures/localization-candidates/` (a small directory of fixture files)

**Why this exists:** verified directly against real data that `CardInfo_*.txt` structural files
don't localize via a predictable filename transform — e.g. `CardInfo_ch7_FinalBand.txt` (Korean
structural data) localizes via `EN_BattleCards_Ch7_BandFinal.txt` ("FinalBand" vs "BandFinal" —
word order differs), and `CardInfo_ch7_Upper.txt` localizes via `EN_BattleCards_Ch7_Pluto.txt`
(no naming relationship at all). Filename guessing would silently produce wrong pairings — the
exact bug class the Phase 1a-core final review caught in `parseKeyPages.ts`. Instead, this
resolver reads the real card IDs out of the structural file and picks whichever candidate
localization file contains the most of them.

- [ ] **Step 1: Create fixture files** representing the real ambiguity this resolver must
  handle — a structural file whose first ID happens to also appear in an unrelated localization
  file (mirroring `CardInfo_Basic.txt`'s low IDs like `1`/`2` appearing in many files as
  boilerplate "Evade"/"Guard" system cards), so a naive "first ID" check would pick the wrong
  file.

  `pipeline/test/fixtures/localization-candidates/Structural_sample.txt`:
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <DiceCardXmlRoot xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <Card ID="1">
      <Name>회피</Name>
      <Artwork>evade</Artwork>
      <Rarity>Common</Rarity>
      <Spec Range="Near" Cost="0" />
      <BehaviourList />
      <Chapter>0</Chapter>
    </Card>
    <Card ID="500001">
      <Name>진짜카드</Name>
      <Artwork>real1</Artwork>
      <Rarity>Common</Rarity>
      <Spec Range="Near" Cost="0" />
      <BehaviourList />
      <Chapter>0</Chapter>
    </Card>
    <Card ID="500002">
      <Name>진짜카드2</Name>
      <Artwork>real2</Artwork>
      <Rarity>Common</Rarity>
      <Spec Range="Near" Cost="0" />
      <BehaviourList />
      <Chapter>0</Chapter>
    </Card>
  </DiceCardXmlRoot>
  ```

  `pipeline/test/fixtures/localization-candidates/EN_Wrong.txt` (contains ID 1, a decoy — this
  is the trap a naive "first ID" resolver would fall into):
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <BattleCardDescRoot xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <cardDescList>
      <BattleCardDesc ID="1">
        <LocalizedName>Evade</LocalizedName>
      </BattleCardDesc>
    </cardDescList>
  </BattleCardDescRoot>
  ```

  `pipeline/test/fixtures/localization-candidates/EN_Right.txt` (contains ID 1 AND both real
  IDs — the correct match, because it has the highest overlap count):
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <BattleCardDescRoot xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <cardDescList>
      <BattleCardDesc ID="1">
        <LocalizedName>Evade</LocalizedName>
      </BattleCardDesc>
      <BattleCardDesc ID="500001">
        <LocalizedName>Real Card One</LocalizedName>
      </BattleCardDesc>
      <BattleCardDesc ID="500002">
        <LocalizedName>Real Card Two</LocalizedName>
      </BattleCardDesc>
    </cardDescList>
  </BattleCardDescRoot>
  ```

- [ ] **Step 2: Write the failing test** at `pipeline/test/resolveLocalization.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest";
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  import { pickBestLocalizationFile } from "../src/resolveLocalization.js";

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixtures = path.join(__dirname, "fixtures", "localization-candidates");

  describe("pickBestLocalizationFile", () => {
    it("picks the candidate with the highest real ID overlap, not just any match", () => {
      const structuralIds = ["1", "500001", "500002"];
      const candidates = [
        path.join(fixtures, "EN_Wrong.txt"),
        path.join(fixtures, "EN_Right.txt"),
      ];

      const result = pickBestLocalizationFile(structuralIds, candidates);

      expect(result).toBe(path.join(fixtures, "EN_Right.txt"));
    });

    it("returns null when no candidate has any overlap", () => {
      const structuralIds = ["999999"];
      const candidates = [path.join(fixtures, "EN_Wrong.txt")];

      const result = pickBestLocalizationFile(structuralIds, candidates);

      expect(result).toBeNull();
    });
  });
  ```

- [ ] **Step 3: Run test to verify it fails.** Run:
  `cd pipeline && npx vitest run test/resolveLocalization.test.ts`
  Expected: FAIL — `Cannot find module '../src/resolveLocalization.js'`

- [ ] **Step 4: Write the implementation** at `pipeline/src/resolveLocalization.ts`:

  ```typescript
  import { readXml, toArray } from "./xml.js";

  function extractCardDescIds(filePath: string): Set<string> {
    const doc = readXml(filePath);
    const entries = toArray<any>(doc.BattleCardDescRoot?.cardDescList?.BattleCardDesc);
    return new Set(entries.map((entry) => String(entry["@_ID"])));
  }

  export function pickBestLocalizationFile(
    structuralIds: string[],
    candidateFiles: string[]
  ): string | null {
    let bestFile: string | null = null;
    let bestCount = 0;

    for (const candidate of candidateFiles) {
      const candidateIds = extractCardDescIds(candidate);
      let count = 0;
      for (const id of structuralIds) {
        if (candidateIds.has(id)) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestFile = candidate;
      }
    }

    return bestFile;
  }
  ```

- [ ] **Step 5: Run test to verify it passes.** Run:
  `cd pipeline && npx vitest run test/resolveLocalization.test.ts`
  Expected: PASS (2 tests)

- [ ] **Step 6: Commit:**
  ```bash
  git add pipeline/src/resolveLocalization.ts pipeline/test/resolveLocalization.test.ts pipeline/test/fixtures/localization-candidates/
  git commit -m "feat: add ID-overlap-based localization file resolver"
  ```

---

## Task 2: File discovery helper

**Files:**
- Create: `pipeline/src/discoverFiles.ts`
- Create: `pipeline/test/discoverFiles.test.ts`

**Why this exists:** rather than hand-typing every `CardInfo_*.txt`/`EquipPage_*.txt`/etc.
filename into a static list (error-prone — Task 1's whole point is that hand-typed mappings are
where mistakes hide), the orchestrator discovers structural files by prefix match against the
real directory listing, then resolves each one's localization file with Task 1's resolver.

- [ ] **Step 1: Write the failing test** at `pipeline/test/discoverFiles.test.ts`:

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from "vitest";
  import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
  import { tmpdir } from "node:os";
  import path from "node:path";
  import { listFilesByPrefix } from "../src/discoverFiles.js";

  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "lor-discover-"));
    writeFileSync(path.join(root, "CardInfo_ch1.txt"), "");
    writeFileSync(path.join(root, "CardInfo_ch2.txt"), "");
    writeFileSync(path.join(root, "EquipPage_ch1.txt"), "");
    writeFileSync(path.join(root, "CardInfoJan.txt"), "");
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe("listFilesByPrefix", () => {
    it("returns full paths of files starting with the given prefix, sorted", () => {
      const result = listFilesByPrefix(root, "CardInfo");
      expect(result).toEqual([
        path.join(root, "CardInfoJan.txt"),
        path.join(root, "CardInfo_ch1.txt"),
        path.join(root, "CardInfo_ch2.txt"),
      ]);
    });

    it("returns an empty array when nothing matches", () => {
      expect(listFilesByPrefix(root, "NoSuchPrefix")).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails.** Run:
  `cd pipeline && npx vitest run test/discoverFiles.test.ts`
  Expected: FAIL — `Cannot find module '../src/discoverFiles.js'`

- [ ] **Step 3: Write the implementation** at `pipeline/src/discoverFiles.ts`:

  ```typescript
  import { readdirSync } from "node:fs";
  import path from "node:path";

  export function listFilesByPrefix(dir: string, prefix: string): string[] {
    return readdirSync(dir)
      .filter((entry) => entry.startsWith(prefix))
      .sort()
      .map((entry) => path.join(dir, entry));
  }
  ```

- [ ] **Step 4: Run test to verify it passes.** Run:
  `cd pipeline && npx vitest run test/discoverFiles.test.ts`
  Expected: PASS (2 tests)

- [ ] **Step 5: Commit:**
  ```bash
  git add pipeline/src/discoverFiles.ts pipeline/test/discoverFiles.test.ts
  git commit -m "feat: add prefix-based structural file discovery helper"
  ```

---

## Task 3: Deck parser

**Files:**
- Create: `pipeline/src/parseDecks.ts`
- Create: `pipeline/test/parseDecks.test.ts`
- Create: `pipeline/test/fixtures/Deck_sample.txt`

**Schema, verified against real `Deck_enemy_ch1.txt`:** `DeckXmlRoot > Deck[@ID] > Card[]` (a
list of card ID text nodes, duplicates allowed — a deck can include the same card multiple
times). No localization needed — deck lists have no display text of their own, they're pure
structure.

- [ ] **Step 1: Create the fixture** at `pipeline/test/fixtures/Deck_sample.txt`:

  ```xml
  <?xml version="1.0" encoding="utf-8" ?>
  <DeckXmlRoot>
    <Deck ID="101001">
      <Card>102006</Card>
      <Card>102006</Card>
      <Card>100001</Card>
      <Card>100002</Card>
    </Deck>
    <Deck ID="101002">
      <Card>100003</Card>
    </Deck>
  </DeckXmlRoot>
  ```

- [ ] **Step 2: Write the failing test** at `pipeline/test/parseDecks.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest";
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  import { parseDeckFile } from "../src/parseDecks.js";

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixtures = path.join(__dirname, "fixtures");

  describe("parseDeckFile", () => {
    it("parses decks into a map from deck ID to its list of card IDs, duplicates preserved", () => {
      const decks = parseDeckFile(path.join(fixtures, "Deck_sample.txt"));

      expect(decks.get("101001")).toEqual(["102006", "102006", "100001", "100002"]);
      expect(decks.get("101002")).toEqual(["100003"]);
      expect(decks.size).toBe(2);
    });
  });
  ```

- [ ] **Step 3: Run test to verify it fails.** Run:
  `cd pipeline && npx vitest run test/parseDecks.test.ts`
  Expected: FAIL — `Cannot find module '../src/parseDecks.js'`

- [ ] **Step 4: Write the implementation** at `pipeline/src/parseDecks.ts`:

  ```typescript
  import { readXml, toArray } from "./xml.js";

  export function parseDeckFile(filePath: string): Map<string, string[]> {
    const doc = readXml(filePath);
    const deckNodes = toArray<any>(doc.DeckXmlRoot?.Deck);
    const decks = new Map<string, string[]>();

    for (const node of deckNodes) {
      const id = String(node["@_ID"]);
      const cardIds = toArray<string | number>(node.Card).map((c) => String(c));
      decks.set(id, cardIds);
    }

    return decks;
  }
  ```

- [ ] **Step 5: Run test to verify it passes.** Run:
  `cd pipeline && npx vitest run test/parseDecks.test.ts`
  Expected: PASS (1 test)

- [ ] **Step 6: Commit:**
  ```bash
  git add pipeline/src/parseDecks.ts pipeline/test/parseDecks.test.ts pipeline/test/fixtures/Deck_sample.txt
  git commit -m "feat: add deck parser"
  ```

---

## Task 4: Passive parser

**Files:**
- Create: `pipeline/src/parsePassives.ts`
- Create: `pipeline/test/parsePassives.test.ts`
- Create: `pipeline/test/fixtures/PassiveList_sample.txt`
- Create: `pipeline/test/fixtures/EN_PassiveDesc_sample.txt`

**Schema, verified against real `PassiveList.txt` and `EN_PassiveDesc.txt`:** structural is
`PassiveXmlRoot > Passive[@ID] > Level, Rarity` (Rarity is optional — not every Passive node has
one). Localization is `PassiveDescRoot > PassiveDesc[@ID] > Name, Desc`, joined by the same ID.

- [ ] **Step 1: Create the fixtures.**

  `pipeline/test/fixtures/PassiveList_sample.txt`:
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <PassiveXmlRoot>
    <Passive ID="1001011">
      <Level>1</Level>
      <Rarity>Common</Rarity>
    </Passive>
    <Passive ID="1001012">
      <Level>1</Level>
    </Passive>
  </PassiveXmlRoot>
  ```

  `pipeline/test/fixtures/EN_PassiveDesc_sample.txt`:
  ```xml
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <PassiveDescRoot xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <PassiveDesc ID="1001011">
      <Name>Scars</Name>
      <Desc>Take 1-5 less damage from Slash attacks.</Desc>
    </PassiveDesc>
    <PassiveDesc ID="1001012">
      <Name>Blood</Name>
      <Desc>Lose 3 Speed. Boost the max value of Block dice by +3.</Desc>
    </PassiveDesc>
  </PassiveDescRoot>
  ```

- [ ] **Step 2: Write the failing test** at `pipeline/test/parsePassives.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest";
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  import { loadPassiveDescriptions, parsePassiveFile } from "../src/parsePassives.js";

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixtures = path.join(__dirname, "fixtures");

  describe("parsePassiveFile", () => {
    it("parses passives and joins name/description by ID", () => {
      const descriptions = loadPassiveDescriptions(
        path.join(fixtures, "EN_PassiveDesc_sample.txt")
      );
      const passives = parsePassiveFile(
        path.join(fixtures, "PassiveList_sample.txt"),
        descriptions
      );

      expect(passives).toHaveLength(2);
      expect(passives[0]).toEqual({
        id: "1001011",
        name: "Scars",
        desc: "Take 1-5 less damage from Slash attacks.",
        level: 1,
        rarity: "Common",
      });
      expect(passives[1]).toEqual({
        id: "1001012",
        name: "Blood",
        desc: "Lose 3 Speed. Boost the max value of Block dice by +3.",
        level: 1,
        rarity: "",
      });
    });
  });
  ```

- [ ] **Step 3: Run test to verify it fails.** Run:
  `cd pipeline && npx vitest run test/parsePassives.test.ts`
  Expected: FAIL — `Cannot find module '../src/parsePassives.js'`

- [ ] **Step 4: Write the implementation** at `pipeline/src/parsePassives.ts`:

  ```typescript
  import { readXml, toArray } from "./xml.js";

  export interface PassiveDescription {
    name: string;
    desc: string;
  }

  export interface Passive {
    id: string;
    name: string;
    desc: string;
    level: number;
    rarity: string;
  }

  export function loadPassiveDescriptions(filePath: string): Map<string, PassiveDescription> {
    const doc = readXml(filePath);
    const entries = toArray<any>(doc.PassiveDescRoot?.PassiveDesc);
    const map = new Map<string, PassiveDescription>();

    for (const entry of entries) {
      const id = String(entry["@_ID"]);
      map.set(id, {
        name: typeof entry.Name === "string" ? entry.Name : "",
        desc: typeof entry.Desc === "string" ? entry.Desc : "",
      });
    }

    return map;
  }

  export function parsePassiveFile(
    filePath: string,
    descriptions: Map<string, PassiveDescription>
  ): Passive[] {
    const doc = readXml(filePath);
    const nodes = toArray<any>(doc.PassiveXmlRoot?.Passive);

    return nodes.map((node): Passive => {
      const id = String(node["@_ID"]);
      const desc = descriptions.get(id);

      return {
        id,
        name: desc?.name ?? "",
        desc: desc?.desc ?? "",
        level: Number(node.Level ?? 0),
        rarity: String(node.Rarity ?? ""),
      };
    });
  }
  ```

- [ ] **Step 5: Run test to verify it passes.** Run:
  `cd pipeline && npx vitest run test/parsePassives.test.ts`
  Expected: PASS (1 test)

- [ ] **Step 6: Commit:**
  ```bash
  git add pipeline/src/parsePassives.ts pipeline/test/parsePassives.test.ts pipeline/test/fixtures/PassiveList_sample.txt pipeline/test/fixtures/EN_PassiveDesc_sample.txt
  git commit -m "feat: add passive parser with English description join"
  ```

---

## Task 5: Stage parser

**Files:**
- Create: `pipeline/src/parseStages.ts`
- Create: `pipeline/test/parseStages.test.ts`
- Create: `pipeline/test/fixtures/StageInfo_sample.txt`

**Schema, verified against real `StageInfo.txt`:** `StageXmlRoot > Stage[@id] > Wave >
Formation, Unit[] (enemy IDs, can repeat) ; FloorNum ; Chapter ; StoryType ; Story[@Condition]`
(zero, one, or two `Story` nodes — `Condition="Start"` and/or `Condition="End"`, each holding a
scene-file reference like `"1_2_1"` corresponding to `Chapter_1_2_1.txt`, or empty). `Name` is
optional (not every stage has one — verified: `Stage id="1"` in the real file has no `Name`).

- [ ] **Step 1: Create the fixture** at `pipeline/test/fixtures/StageInfo_sample.txt`:

  ```xml
  <?xml version="1.0" encoding="utf-8" ?>
  <StageXmlRoot>
    <Stage id="1">
      <Wave>
        <Unit>1</Unit>
        <Unit>1</Unit>
      </Wave>
      <FloorNum>1</FloorNum>
    </Stage>
    <Stage id="2">
      <Name>쥐</Name>
      <Wave>
        <Formation>2</Formation>
        <Unit>3</Unit>
        <Unit>1</Unit>
        <Unit>2</Unit>
      </Wave>
      <FloorNum>1</FloorNum>
      <Chapter>1</Chapter>
      <StoryType>Rats</StoryType>
      <Story Condition="Start">1_2_1</Story>
      <Story Condition="End">1_2_2</Story>
    </Stage>
  </StageXmlRoot>
  ```

- [ ] **Step 2: Write the failing test** at `pipeline/test/parseStages.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest";
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  import { parseStageFile } from "../src/parseStages.js";

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixtures = path.join(__dirname, "fixtures");

  describe("parseStageFile", () => {
    it("parses stages, including one with no Name/Chapter/Story data", () => {
      const stages = parseStageFile(path.join(fixtures, "StageInfo_sample.txt"));

      expect(stages).toHaveLength(2);
      expect(stages[0]).toEqual({
        id: "1",
        name: "",
        enemyIds: ["1", "1"],
        formation: "",
        floorNum: 1,
        chapter: 0,
        storyType: "",
        storyStart: "",
        storyEnd: "",
      });
    });

    it("parses a fully-populated stage, including its story scene pointers", () => {
      const stages = parseStageFile(path.join(fixtures, "StageInfo_sample.txt"));

      expect(stages[1]).toEqual({
        id: "2",
        name: "쥐",
        enemyIds: ["3", "1", "2"],
        formation: "2",
        floorNum: 1,
        chapter: 1,
        storyType: "Rats",
        storyStart: "1_2_1",
        storyEnd: "1_2_2",
      });
    });
  });
  ```

- [ ] **Step 3: Run test to verify it fails.** Run:
  `cd pipeline && npx vitest run test/parseStages.test.ts`
  Expected: FAIL — `Cannot find module '../src/parseStages.js'`

- [ ] **Step 4: Write the implementation** at `pipeline/src/parseStages.ts`:

  ```typescript
  import { readXml, toArray } from "./xml.js";

  export interface Stage {
    id: string;
    name: string;
    enemyIds: string[];
    formation: string;
    floorNum: number;
    chapter: number;
    storyType: string;
    storyStart: string;
    storyEnd: string;
  }

  export function parseStageFile(filePath: string): Stage[] {
    const doc = readXml(filePath);
    const nodes = toArray<any>(doc.StageXmlRoot?.Stage);

    return nodes.map((node): Stage => {
      const storyNodes = toArray<any>(node.Story);
      const storyStart = storyNodes.find((s) => s["@_Condition"] === "Start");
      const storyEnd = storyNodes.find((s) => s["@_Condition"] === "End");

      return {
        id: String(node["@_id"]),
        name: String(node.Name ?? ""),
        enemyIds: toArray<string | number>(node.Wave?.Unit).map((u) => String(u)),
        formation: String(node.Wave?.Formation ?? ""),
        floorNum: Number(node.FloorNum ?? 0),
        chapter: Number(node.Chapter ?? 0),
        storyType: String(node.StoryType ?? ""),
        storyStart: typeof storyStart === "object" ? String(storyStart["#text"] ?? "") : "",
        storyEnd: typeof storyEnd === "object" ? String(storyEnd["#text"] ?? "") : "",
      };
    });
  }
  ```

- [ ] **Step 5: Run test to verify it passes.** Run:
  `cd pipeline && npx vitest run test/parseStages.test.ts`
  Expected: PASS (2 tests). **If the `storyStart`/`storyEnd` assertions fail** because
  `fast-xml-parser` represents a `<Story Condition="Start">1_2_1</Story>` node differently than
  `{"@_Condition": "Start", "#text": "1_2_1"}` (e.g. as a plain string when there's only one
  `Story` node, since `toArray` would then wrap a single object, not affecting this — but the
  attribute+text shape itself might differ), adjust the extraction to match the actual parsed
  shape, the same way Task 4 of the prior plan (`localization.ts`'s `loadNameMap`) had a
  documented contingency for this exact class of `fast-xml-parser` quirk. Verify by temporarily
  logging `storyNodes` if the assertion fails, then fix the extraction accordingly.

- [ ] **Step 6: Commit:**
  ```bash
  git add pipeline/src/parseStages.ts pipeline/test/parseStages.test.ts pipeline/test/fixtures/StageInfo_sample.txt
  git commit -m "feat: add stage parser"
  ```

---

## Task 6: Story parser

**Files:**
- Create: `pipeline/src/parseStory.ts`
- Create: `pipeline/test/parseStory.test.ts`
- Create: `pipeline/test/fixtures/EN_Chapter_sample.txt`

**Schema, verified against real `EN_Chapter1.txt`:** self-contained (no Korean/English join
needed — this file already IS the display text), `ScenarioRoot > Chapter[@ID] > Title` (chapter
title, once) followed by sibling `Group > GroupName, Episode > EpisodeName, Place > PlaceName,
Dialog[@ID][@Model] > Teller, Title, VoiceFile, Content` (repeated, nested). This parser flattens
that nesting into a flat list of dialogue line records, each carrying its own group/episode/place
context (denormalized — matches the pipeline's general approach of self-contained output
records, established in the `Card`/`KeyPage` design).

- [ ] **Step 1: Create the fixture** at `pipeline/test/fixtures/EN_Chapter_sample.txt`:

  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <ScenarioRoot xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <Chapter ID="1">
      <Title>Chapter 1-Canard-'I go out to the street, my hands in my pockets.'</Title>
    </Chapter>
    <Group>
      <GroupName>Prologue</GroupName>
      <Episode>
        <EpisodeName>Episode 1</EpisodeName>
        <Place>
          <PlaceName>Location: Inside the Library</PlaceName>
          <Dialog ID="0" Model="앤젤라">
            <Teller>???</Teller>
            <Title>???</Title>
            <VoiceFile>ch1_prol1_ep1_angela1</VoiceFile>
            <Content>I still cannot leave this place...</Content>
          </Dialog>
          <Dialog ID="1" Model="롤랑">
            <Teller>???</Teller>
            <Title>???</Title>
            <VoiceFile>ch1_prol1_ep1_roland1</VoiceFile>
            <Content>Damn it... The Purple Tear...</Content>
          </Dialog>
        </Place>
      </Episode>
    </Group>
  </ScenarioRoot>
  ```

- [ ] **Step 2: Write the failing test** at `pipeline/test/parseStory.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest";
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  import { parseStoryFile } from "../src/parseStory.js";

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixtures = path.join(__dirname, "fixtures");

  describe("parseStoryFile", () => {
    it("flattens chapter/group/episode/place/dialog into denormalized dialogue lines", () => {
      const lines = parseStoryFile(path.join(fixtures, "EN_Chapter_sample.txt"));

      expect(lines).toHaveLength(2);
      expect(lines[0]).toEqual({
        chapterId: "1",
        chapterTitle: "Chapter 1-Canard-'I go out to the street, my hands in my pockets.'",
        groupName: "Prologue",
        episodeName: "Episode 1",
        placeName: "Location: Inside the Library",
        dialogId: "0",
        model: "앤젤라",
        teller: "???",
        title: "???",
        voiceFile: "ch1_prol1_ep1_angela1",
        content: "I still cannot leave this place...",
      });
      expect(lines[1].dialogId).toBe("1");
      expect(lines[1].content).toBe("Damn it... The Purple Tear...");
    });
  });
  ```

- [ ] **Step 3: Run test to verify it fails.** Run:
  `cd pipeline && npx vitest run test/parseStory.test.ts`
  Expected: FAIL — `Cannot find module '../src/parseStory.js'`

- [ ] **Step 4: Write the implementation** at `pipeline/src/parseStory.ts`:

  ```typescript
  import { readXml, toArray } from "./xml.js";

  export interface StoryLine {
    chapterId: string;
    chapterTitle: string;
    groupName: string;
    episodeName: string;
    placeName: string;
    dialogId: string;
    model: string;
    teller: string;
    title: string;
    voiceFile: string;
    content: string;
  }

  export function parseStoryFile(filePath: string): StoryLine[] {
    const doc = readXml(filePath);
    const chapterId = String(doc.ScenarioRoot?.Chapter?.["@_ID"] ?? "");
    const chapterTitle = String(doc.ScenarioRoot?.Chapter?.Title ?? "");
    const groups = toArray<any>(doc.ScenarioRoot?.Group);

    const lines: StoryLine[] = [];

    for (const group of groups) {
      const groupName = String(group.GroupName ?? "");
      const episodes = toArray<any>(group.Episode);

      for (const episode of episodes) {
        const episodeName = String(episode.EpisodeName ?? "");
        const places = toArray<any>(episode.Place);

        for (const place of places) {
          const placeName = String(place.PlaceName ?? "");
          const dialogs = toArray<any>(place.Dialog);

          for (const dialog of dialogs) {
            lines.push({
              chapterId,
              chapterTitle,
              groupName,
              episodeName,
              placeName,
              dialogId: String(dialog["@_ID"]),
              model: String(dialog["@_Model"] ?? ""),
              teller: String(dialog.Teller ?? ""),
              title: String(dialog.Title ?? ""),
              voiceFile: String(dialog.VoiceFile ?? ""),
              content: String(dialog.Content ?? ""),
            });
          }
        }
      }
    }

    return lines;
  }
  ```

- [ ] **Step 5: Run test to verify it passes.** Run:
  `cd pipeline && npx vitest run test/parseStory.test.ts`
  Expected: PASS (1 test)

- [ ] **Step 6: Commit:**
  ```bash
  git add pipeline/src/parseStory.ts pipeline/test/parseStory.test.ts pipeline/test/fixtures/EN_Chapter_sample.txt
  git commit -m "feat: add story parser for EN_Chapter narrative text"
  ```

---

## Task 7: Abnormality codex parser

**Files:**
- Create: `pipeline/src/parseAbnormalityCodex.ts`
- Create: `pipeline/test/parseAbnormalityCodex.test.ts`
- Create: `pipeline/test/fixtures/EN_AbnormalityCards_sample.txt`

**Schema, verified against real `EN_AbnormalityCards.txt`:** self-contained, English-only,
`AbnormalityCardsRoot > Sephirah[@SephirahType] > AbnormalityCard[@ID]` where `@ID` is a
**string** (e.g. `"ScorchedGirl_Walk"`), holding `Abnormality` (creature name), `CardName`,
`AbilityDesc`, `FlaborText` (this is a real typo in the source XML tag name — `FlaborText`, not
`FlavorText` — preserved as-is since it's the literal tag the source data uses), and a
`Dialogues > Dialogue[@ID]` list of combat barks.

- [ ] **Step 1: Create the fixture** at `pipeline/test/fixtures/EN_AbnormalityCards_sample.txt`:

  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <AbnormalityCardsRoot xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <Sephirah SephirahType="Malkuth">
      <AbnormalityCard ID="ScorchedGirl_Walk">
        <Abnormality>Scorched Girl</Abnormality>
        <CardName>Footfalls</CardName>
        <AbilityDesc>[All Allies]
  When a librarian's HP is at 20% or lower, deal 30% of the target's Max HP as damage.</AbilityDesc>
        <FlaborText>I am coming to you. You, who will be reduced to ash like me.</FlaborText>
        <Dialogues>
          <Dialogue ID="1">If I must perish, then join me.</Dialogue>
          <Dialogue ID="2">It's just too sad to die alone...</Dialogue>
        </Dialogues>
      </AbnormalityCard>
    </Sephirah>
  </AbnormalityCardsRoot>
  ```

- [ ] **Step 2: Write the failing test** at `pipeline/test/parseAbnormalityCodex.test.ts`:

  ```typescript
  import { describe, it, expect } from "vitest";
  import path from "node:path";
  import { fileURLToPath } from "node:url";
  import { parseAbnormalityCodexFile } from "../src/parseAbnormalityCodex.js";

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixtures = path.join(__dirname, "fixtures");

  describe("parseAbnormalityCodexFile", () => {
    it("parses abnormality codex entries with their dialogue lines", () => {
      const entries = parseAbnormalityCodexFile(
        path.join(fixtures, "EN_AbnormalityCards_sample.txt")
      );

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        id: "ScorchedGirl_Walk",
        sephirahType: "Malkuth",
        abnormality: "Scorched Girl",
        cardName: "Footfalls",
        abilityDesc:
          "[All Allies]\n  When a librarian's HP is at 20% or lower, deal 30% of the target's Max HP as damage.",
        flavorText: "I am coming to you. You, who will be reduced to ash like me.",
        dialogues: [
          "If I must perish, then join me.",
          "It's just too sad to die alone...",
        ],
      });
    });
  });
  ```

  **Note on the `abilityDesc` expected value's exact whitespace**: `fast-xml-parser` preserves
  the literal text content of multi-line elements, including the fixture's line break and
  leading spaces on the second line. If this exact string doesn't match after implementing,
  read the actual parsed value (temporarily log it) and update the expectation to match reality
  — the important behavior being tested is that the field is captured at all and not empty or
  truncated, not the exact whitespace bytes.

- [ ] **Step 3: Run test to verify it fails.** Run:
  `cd pipeline && npx vitest run test/parseAbnormalityCodex.test.ts`
  Expected: FAIL — `Cannot find module '../src/parseAbnormalityCodex.js'`

- [ ] **Step 4: Write the implementation** at `pipeline/src/parseAbnormalityCodex.ts`:

  ```typescript
  import { readXml, toArray } from "./xml.js";

  export interface AbnormalityCodexEntry {
    id: string;
    sephirahType: string;
    abnormality: string;
    cardName: string;
    abilityDesc: string;
    flavorText: string;
    dialogues: string[];
  }

  export function parseAbnormalityCodexFile(filePath: string): AbnormalityCodexEntry[] {
    const doc = readXml(filePath);
    const sephirahNodes = toArray<any>(doc.AbnormalityCardsRoot?.Sephirah);

    const entries: AbnormalityCodexEntry[] = [];

    for (const sephirah of sephirahNodes) {
      const sephirahType = String(sephirah["@_SephirahType"] ?? "");
      const cardNodes = toArray<any>(sephirah.AbnormalityCard);

      for (const card of cardNodes) {
        const dialogueNodes = toArray<string>(card.Dialogues?.Dialogue).filter(
          (d): d is string => typeof d === "string"
        );

        entries.push({
          id: String(card["@_ID"]),
          sephirahType,
          abnormality: String(card.Abnormality ?? ""),
          cardName: String(card.CardName ?? ""),
          abilityDesc: String(card.AbilityDesc ?? ""),
          flavorText: String(card.FlaborText ?? ""),
          dialogues: dialogueNodes,
        });
      }
    }

    return entries;
  }
  ```

- [ ] **Step 5: Run test to verify it passes.** Run:
  `cd pipeline && npx vitest run test/parseAbnormalityCodex.test.ts`
  Expected: PASS (1 test) — after resolving the whitespace note from Step 2 if needed.

- [ ] **Step 6: Commit:**
  ```bash
  git add pipeline/src/parseAbnormalityCodex.ts pipeline/test/parseAbnormalityCodex.test.ts pipeline/test/fixtures/EN_AbnormalityCards_sample.txt
  git commit -m "feat: add abnormality codex parser"
  ```

---

## Task 8: Full-coverage orchestrator rewrite

**Files:**
- Modify: `pipeline/src/index.ts`

This is the integration task — no new unit tests (consistent with how the original Task 9 of the
prior plan worked: the pass condition is a real run against real data, not new fixtures). Uses
Tasks 1–7 plus the existing Card/KeyPage/Enemy/art-resolver modules.

- [ ] **Step 1: Rewrite `pipeline/src/index.ts`:**

  ```typescript
  import "dotenv/config";
  import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
  import path from "node:path";
  import { loadConfig } from "./config.js";
  import {
    loadCardLocalization,
    loadBookLocalization,
    loadNameMap,
  } from "./localization.js";
  import { parseCardFile } from "./parseCards.js";
  import { parseKeyPageFile } from "./parseKeyPages.js";
  import { parseEnemyFile } from "./parseEnemies.js";
  import { parseDeckFile } from "./parseDecks.js";
  import { loadPassiveDescriptions, parsePassiveFile } from "./parsePassives.js";
  import { parseStageFile } from "./parseStages.js";
  import { parseStoryFile } from "./parseStory.js";
  import { parseAbnormalityCodexFile } from "./parseAbnormalityCodex.js";
  import { buildArtIndex, resolveArtPath } from "./resolveArt.js";
  import { listFilesByPrefix } from "./discoverFiles.js";
  import { pickBestLocalizationFile } from "./resolveLocalization.js";
  import { readXml, toArray } from "./xml.js";
  import type { Card } from "./types.js";

  function extractCardIds(filePath: string): string[] {
    const doc = readXml(filePath);
    return toArray<any>(doc.DiceCardXmlRoot?.Card).map((c) => String(c["@_ID"]));
  }

  function main(): void {
    const config = loadConfig();
    const outDir = path.resolve("data");
    const artOutDir = path.join(outDir, "art");
    mkdirSync(artOutDir, { recursive: true });

    const en = (name: string) => path.join(config.textRoot, "English", name);
    const kr = (name: string) => path.join(config.textRoot, name);
    const englishDir = path.join(config.textRoot, "English");

    // --- Cards: discover every CardInfo_* structural file, resolve its correct
    // localization file by real ID overlap (not filename guessing — verified during
    // design that filenames like "FinalBand" vs "BandFinal" don't line up), then parse. ---
    const cardStructuralFiles = [
      ...listFilesByPrefix(config.textRoot, "CardInfo_"),
      ...listFilesByPrefix(config.textRoot, "CardInfoJan"),
    ];
    const battleCardsCandidates = listFilesByPrefix(englishDir, "EN_BattleCards");
    const cardLocalizationCache = new Map<string, Map<string, string>>();

    let cards: Card[] = [];
    for (const structuralFile of cardStructuralFiles) {
      const ids = extractCardIds(structuralFile);
      const bestFile = pickBestLocalizationFile(ids, battleCardsCandidates);
      const localizationFile = bestFile ?? en("EN_BattleCards.txt");

      if (!cardLocalizationCache.has(localizationFile)) {
        cardLocalizationCache.set(localizationFile, loadCardLocalization(localizationFile));
      }
      const localization = cardLocalizationCache.get(localizationFile)!;

      cards = cards.concat(parseCardFile(structuralFile, localization));
    }

    // --- Key pages: every EquipPage_* file joins the single EN_Books.txt (verified —
    // there is only one localization file for this whole family, unlike Cards). ---
    const bookLocalization = loadBookLocalization(en("EN_Books.txt"));
    const keyPageFiles = listFilesByPrefix(config.textRoot, "EquipPage_");
    let keyPages = keyPageFiles.flatMap((f) => parseKeyPageFile(f, bookLocalization));

    // --- Enemies: every EnemyUnitInfo_* file, name resolved via character/creature name maps. ---
    const characterNames = loadNameMap(en("EN_CharactersName.txt"));
    const creatureNames = loadNameMap(en("EN_CreatureName.txt"));
    const enemyNames = new Map([...characterNames, ...creatureNames]);
    const enemyFiles = listFilesByPrefix(config.textRoot, "EnemyUnitInfo");
    let enemies = enemyFiles.flatMap((f) => parseEnemyFile(f, enemyNames));

    // --- Decks: every Deck_* file. ---
    const deckFiles = listFilesByPrefix(config.textRoot, "Deck_");
    const decks = new Map<string, string[]>();
    for (const f of deckFiles) {
      for (const [id, cardIds] of parseDeckFile(f)) {
        decks.set(id, cardIds);
      }
    }

    // Resolve Enemy.deckId -> actual card ID list, now that decks are parsed.
    const enemiesWithDecks = enemies.map((enemy) => ({
      ...enemy,
      deckCardIds: decks.get(enemy.deckId) ?? [],
    }));

    // --- Passives: every PassiveList* file, localization resolved per-file the same way
    // as Cards (ch7 boss passives split across per-boss EN_PassiveDesc_Ch7_*.txt files). ---
    const passiveDescCandidates = [
      ...listFilesByPrefix(englishDir, "EN_PassiveDesc"),
      ...listFilesByPrefix(englishDir, "EN_CreaturePassive"),
    ];
    const passiveStructuralFiles = listFilesByPrefix(config.textRoot, "PassiveList");
    const passiveDescCache = new Map<string, ReturnType<typeof loadPassiveDescriptions>>();

    let passives: ReturnType<typeof parsePassiveFile> = [];
    for (const structuralFile of passiveStructuralFiles) {
      const doc = readXml(structuralFile);
      const ids = toArray<any>(doc.PassiveXmlRoot?.Passive).map((p) => String(p["@_ID"]));
      const bestFile = pickBestLocalizationFile(ids, passiveDescCandidates);
      const localizationFile = bestFile ?? en("EN_PassiveDesc.txt");

      if (!passiveDescCache.has(localizationFile)) {
        passiveDescCache.set(localizationFile, loadPassiveDescriptions(localizationFile));
      }
      const descriptions = passiveDescCache.get(localizationFile)!;

      passives = passives.concat(parsePassiveFile(structuralFile, descriptions));
    }

    // --- Stages: every StageInfo* file. ---
    const stageFiles = listFilesByPrefix(config.textRoot, "StageInfo");
    const stages = stageFiles.flatMap((f) => parseStageFile(f));

    // --- Story: every EN_Chapter* file (self-contained, no join needed). ---
    const storyFiles = listFilesByPrefix(englishDir, "EN_Chapter");
    const story = storyFiles.flatMap((f) => parseStoryFile(f));

    // --- Abnormality codex: single file. ---
    const abnormalityCodex = parseAbnormalityCodexFile(en("EN_AbnormalityCards.txt"));

    // --- Art resolution (unchanged approach, now applied to every card). ---
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
    writeFileSync(
      path.join(outDir, "enemies.json"),
      JSON.stringify(enemiesWithDecks, null, 2)
    );
    writeFileSync(path.join(outDir, "passives.json"), JSON.stringify(passives, null, 2));
    writeFileSync(path.join(outDir, "stages.json"), JSON.stringify(stages, null, 2));
    writeFileSync(path.join(outDir, "story.json"), JSON.stringify(story, null, 2));
    writeFileSync(
      path.join(outDir, "abnormalityCodex.json"),
      JSON.stringify(abnormalityCodex, null, 2)
    );

    console.log(
      `Wrote ${cards.length} cards, ${keyPages.length} key pages, ${enemiesWithDecks.length} enemies, ` +
        `${passives.length} passives, ${stages.length} stages, ${story.length} story lines, ` +
        `${abnormalityCodex.length} abnormality codex entries to ${outDir}`
    );
  }

  main();
  ```

- [ ] **Step 2: Run against real data.** Run: `cd pipeline && npm run parse`
  Expected: prints a summary line with nonzero counts for every category, no thrown errors.

- [ ] **Step 3: Spot-check the fix for the class of bug the prior plan's final review caught.**
  Open `pipeline/data/keypages.json` and find an entry whose source came from a file OTHER than
  `EquipPage_ch1.txt` (e.g. search for a `characterSkin` or `id` you know is from Chapter 2+ —
  or simply confirm `keypages.json` now has significantly more than 15 entries, since it's no
  longer Chapter-1-only). Confirm its `name`/`paragraphs` are real English text, not empty
  strings or Korean — this is the direct verification that the `TextId`-based join (fixed in the
  prior plan) generalizes correctly beyond Chapter 1's coincidental `@ID == TextId` case.

- [ ] **Step 4: Spot-check the localization resolver on a known-tricky case.** Open
  `pipeline/data/cards.json`, find a card whose `id` starts with `707` (from
  `CardInfo_ch7_FinalBand.txt`, verified during design to localize via the oddly-named
  `EN_BattleCards_Ch7_BandFinal.txt`) and confirm its `name` is real English text, not the raw
  Korean fallback — this verifies the resolver picked the correct file despite the filename
  mismatch.

- [ ] **Step 5: Verify `Enemy.deckCardIds` resolves correctly.** Open `enemies.json`, pick an
  entry with a non-empty `deckId`, and confirm `deckCardIds` is a non-empty array of card ID
  strings (not the raw unresolved `deckId`).

- [ ] **Step 6: Commit:**
  ```bash
  git add pipeline/src/index.ts
  git commit -m "feat: full-coverage orchestrator - all chapters, decks, passives, stages, story, abnormality codex"
  ```

---

## Task 9: Update Enemy type and README

**Files:**
- Modify: `pipeline/src/types.ts`
- Modify: `pipeline/README.md`

- [ ] **Step 1: Add `deckCardIds` to the `Enemy` interface** in `pipeline/src/types.ts` so the
  orchestrator's spread-and-enrich pattern (`{ ...enemy, deckCardIds: ... }`) is properly typed
  instead of relying on structural typing alone:

  Find:
  ```typescript
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

  Replace with:
  ```typescript
  export interface Enemy {
    id: string;
    name: string;
    bookId: string;
    deckId: string;
    minHeight: number;
    maxHeight: number;
    exp: number;
  }

  export interface EnemyWithDeck extends Enemy {
    deckCardIds: string[];
  }
  ```

- [ ] **Step 2: Update the orchestrator's type annotation** in `pipeline/src/index.ts` — change
  the `enemiesWithDecks` mapping to be explicitly typed:

  Find:
  ```typescript
    // Resolve Enemy.deckId -> actual card ID list, now that decks are parsed.
    const enemiesWithDecks = enemies.map((enemy) => ({
      ...enemy,
      deckCardIds: decks.get(enemy.deckId) ?? [],
    }));
  ```

  Replace with:
  ```typescript
    // Resolve Enemy.deckId -> actual card ID list, now that decks are parsed.
    const enemiesWithDecks: EnemyWithDeck[] = enemies.map((enemy) => ({
      ...enemy,
      deckCardIds: decks.get(enemy.deckId) ?? [],
    }));
  ```

  And add `EnemyWithDeck` to the existing `import type { Card } from "./types.js";` line, making
  it `import type { Card, EnemyWithDeck } from "./types.js";`.

- [ ] **Step 3: Run the full test suite and the real parse again** to confirm nothing broke:
  ```bash
  cd pipeline && npm test && npm run parse
  ```
  Expected: all existing + new tests pass; `npm run parse` succeeds with the same nonzero counts
  as Task 8.

- [ ] **Step 4: Update `pipeline/README.md`'s "Status" and "Known limitations" sections** to
  reflect full coverage. Replace the existing "## Status" and "## Known limitations" sections
  (everything from `## Status` to the end of the file) with:

  ```markdown
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
  ```

- [ ] **Step 5: Commit:**
  ```bash
  git add pipeline/src/types.ts pipeline/src/index.ts pipeline/README.md
  git commit -m "feat: type Enemy.deckCardIds; update README for full coverage"
  ```

---

## Self-Review Notes

- **Spec coverage**: implements the full "Data Model" and "Pipeline" sections of the updated
  design spec — Deck, Passive, Stage, Story, and Abnormality codex parsers (Tasks 3–7), full
  chapter/boss coverage for Card/KeyPage via discovery + resolver (Tasks 1, 2, 8), and the
  `Enemy.deckId` → `deckCardIds` cross-reference fix the prior plan's final review flagged as
  unresolved (Task 8–9). Explicitly deferred (documented in README, not silently dropped): the
  `Chapter_X_Y_Z.txt` staging-to-narrative link, and the Astro site itself.
- **Placeholder scan**: no TBD/TODO language; every step has literal code, an exact fixture, or
  an exact command with an expected result. The two "if this doesn't match, adjust and re-verify"
  contingency notes (Task 5's Story parser, Task 7's whitespace) follow the same pattern the
  prior plan used successfully for `loadNameMap`'s documented `fast-xml-parser` shape
  contingency — not open-ended, they specify exactly what to check and how to fix it.
- **Type consistency**: `Passive`, `Stage`, `StoryLine`, `AbnormalityCodexEntry` field names in
  Tasks 4–7 match exactly what Task 8's orchestrator writes to their respective JSON files.
  `EnemyWithDeck` (Task 9) matches the shape Task 8's `enemiesWithDecks` mapping produces.
