import "dotenv/config";
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

  // Chapter 1 only for now — proves the parse→localize→cross-reference→resolve-art→emit
  // pattern end to end. Remaining chapters and entity types are follow-up work.
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
