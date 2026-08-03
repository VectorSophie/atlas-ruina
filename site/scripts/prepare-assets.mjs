import "dotenv/config";
import { mkdirSync, copyFileSync, cpSync, existsSync, rmSync } from "node:fs";
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

  for (const dir of [fontOutDir, uiOutDir, artOutDir]) {
    rmSync(dir, { recursive: true, force: true });
  }

  mkdirSync(fontOutDir, { recursive: true });
  mkdirSync(uiOutDir, { recursive: true });

  copyFileSync(path.join(fontDir, "Arita-buriM.otf"), path.join(fontOutDir, "Arita-buriM.otf"));
  copyFileSync(path.join(fontDir, "Railway.otf"), path.join(fontOutDir, "Railway.otf"));

  copyFileSync(path.join(textureDir, "frame.png"), path.join(uiOutDir, "frame.png"));
  copyFileSync(path.join(textureDir, "DiceCard.png"), path.join(uiOutDir, "DiceCard.png"));

  for (const detail of ["Evade", "Guard", "Hit", "Penetrate", "Slash"]) {
    const name = `BehaviourDetail_${detail}.png`;
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
