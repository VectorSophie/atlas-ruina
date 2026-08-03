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
