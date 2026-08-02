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
