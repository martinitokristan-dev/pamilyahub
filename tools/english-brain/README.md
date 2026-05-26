# English Brain Data Pipeline

This folder builds committed English knowledge artifacts for EleFam's local chatbot.

## Source files (required)

Place these files in `tools/english-brain/sources/`:

- `oxford3000.txt`
- `oxford5000.json`
- `irregular.verbs.build.json`
- `phrasal.verbs.build.json`
- `aacompletewordset.json`

## Generate outputs

From `frontend/`:

```bash
npm run build:brain
```

or from repo root:

```bash
node tools/english-brain/build.mjs
```

## Generated files

The script writes JSON files to:

`frontend/src/lib/knowledge/generated/`

- `lexicon.json`
- `lemmas.json`
- `phrasals.json`
- `synonyms.json`
- `stats.json`

These generated files are committed to the repo and imported by `frontend/src/lib/knowledge/index.js`.
