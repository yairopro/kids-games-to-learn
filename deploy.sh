#!/usr/bin/env bash
set -e

git add --all
git commit -m "chore" || true
git push || true
firebase deploy
