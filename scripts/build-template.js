#!/usr/bin/env node
'use strict';

/**
 * build-template.js — Pre-publish build script for create-rigging
 *
 * Populates packages/create-rigging/template/ from the current git-tracked
 * files in the repo, applying the exclusion list for .planning/ and packages/.
 *
 * Usage:
 *   node scripts/build-template.js
 *
 * Also runs automatically via packages/create-rigging/package.json prepublishOnly.
 *
 * Requires: Node.js >= 18, git in PATH
 */

import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// scripts/ is one level below repo root
const repoRoot = join(__dirname, '..');
const templateDest = join(repoRoot, 'packages', 'create-rigging', 'template');

// D-10: directories excluded from generated output (beyond .gitignore)
const EXCLUDE_PREFIXES = ['.planning/', 'packages/'];

function main() {
  // Clean previous build (idempotent — safe to re-run)
  if (existsSync(templateDest)) {
    rmSync(templateDest, { recursive: true, force: true });
  }

  // git ls-files: returns all tracked files respecting .gitignore
  // Pitfall 5: must use { cwd: repoRoot } so paths are relative to repo root
  let tracked;
  try {
    tracked = execSync('git ls-files', { cwd: repoRoot })
      .toString()
      .split('\n')
      .filter(Boolean);
  } catch (err) {
    console.error('build-template: failed to run git ls-files. Is git installed and are we in a git repo?');
    console.error(err.message);
    process.exit(1);
  }

  // Apply exclusion list: remove .planning/ and packages/ (entire directories)
  const toInclude = tracked.filter(
    (f) => !EXCLUDE_PREFIXES.some((prefix) => f.startsWith(prefix))
  );

  if (toInclude.length === 0) {
    console.error('build-template: no files to copy after filtering. Check EXCLUDE_PREFIXES and git ls-files output.');
    process.exit(1);
  }

  // Copy each file preserving relative directory structure
  let count = 0;
  for (const relPath of toInclude) {
    const src = join(repoRoot, relPath);
    const dest = join(templateDest, relPath);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    count++;
  }

  console.log(`build-template: copied ${count} files to ${templateDest}`);
}

main();
