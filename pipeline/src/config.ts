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
