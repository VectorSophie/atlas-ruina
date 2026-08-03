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
