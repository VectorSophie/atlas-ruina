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
