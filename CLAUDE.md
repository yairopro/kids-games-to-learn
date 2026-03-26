# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of three educational games for children learning English and math. Built with vanilla HTML/CSS/JavaScript — no build step, no bundler, no npm dependencies. All libraries (React 18, Tailwind CSS, Babel, Canvas Confetti) are loaded via CDN.

## Commands

- **Run locally**: `npx http-server` then open http://localhost:8080
- **Deploy**: `npm run deploy` — commits all changes, pushes to git, and runs `firebase deploy`
- **No lint or test commands exist**

## Architecture

Each game is a **self-contained HTML file** with all JS, CSS, and data inlined. There is no shared code between games.

```
index.html                  — Main menu linking to the three games
math-game/index.html        — Arithmetic practice (React 18 + JSX via Babel)
english-game/letter/index.html — Letter recognition A-Z (vanilla JS)
english-game/word/index.html   — English-Hebrew vocabulary (vanilla JS)
```

- **math-game** uses React components rendered via Babel's in-browser JSX transform
- **english-game** pages use vanilla JS with direct DOM manipulation
- All games use Tailwind CSS from CDN for styling
- Game data (word lists, letter mappings, scores) is hardcoded in each HTML file — no external data files or APIs
- Scores are session-only (no localStorage or backend persistence)
- UI is RTL-friendly (Hebrew primary language for instructions)

## Hosting

Firebase Hosting serves the root directory as-is. Config in `firebase.json` and `.firebaserc` (project: `kids-games-to-learn`).
