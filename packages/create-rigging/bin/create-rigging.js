#!/usr/bin/env node
'use strict';

/**
 * create-rigging — Scaffold a new Rigging DDD project
 *
 * Usage: node packages/create-rigging/bin/create-rigging.js <project-name>
 * After publish: npx create-rigging <project-name>
 *
 * Requires: Node.js >= 18 (D-02)
 */

const {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} = require('fs');
const path = require('path');

const {
  isTextFile,
  substituteProjectName,
  validateProjectName,
  isNodeVersionSufficient,
} = require('../lib/helpers');

// D-03: Node version guard — must be the FIRST logic after requires
if (!isNodeVersionSufficient()) {
  process.stderr.write(
    'create-rigging requires Node.js >= 18. You have: v' + process.versions.node + '\n' +
    'Please upgrade Node.js: https://nodejs.org\n'
  );
  process.exit(1);
}

// Arg validation (D-07, Pitfall 7)
const projectName = process.argv[2];
const validation = validateProjectName(projectName);
if (!validation.valid) {
  console.error(validation.error);
  process.exit(1);
}

// Path traversal guard (Security domain)
const cwd = process.cwd();
const resolvedDest = path.resolve(cwd, projectName);
if (!resolvedDest.startsWith(cwd + path.sep) && resolvedDest !== cwd) {
  console.error('Error: project name cannot contain path separators.');
  process.exit(1);
}

// Destination must not already exist
if (existsSync(resolvedDest)) {
  console.error('Error: directory "' + projectName + '" already exists.');
  process.exit(1);
}

// Locate template — D-06: __dirname relative path
const templateDir = path.join(__dirname, '../template');
if (!existsSync(templateDir)) {
  console.error(
    'Error: template directory not found.\n' +
    'Run: node scripts/build-template.js\n' +
    'Then retry: node packages/create-rigging/bin/create-rigging.js ' + projectName
  );
  process.exit(1);
}

/**
 * Recursively copies srcDir to destDir, applying project-name substitution
 * to text files and copying binary files verbatim.
 */
function copyDir(srcDir, destDir, name) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, name);
    } else if (isTextFile(srcPath)) {
      const content = readFileSync(srcPath, 'utf8');
      writeFileSync(destPath, substituteProjectName(content, name));
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// Execute
console.log('Creating ' + projectName + '...');
copyDir(templateDir, resolvedDest, projectName);

// SCAF-07: next-steps guidance (exact strings required)
console.log('\nDone! Your project is ready.\n');
console.log('  cd ' + projectName);
console.log('  bun install');
console.log('  docker compose up -d');
console.log('  bun test');
console.log('');
