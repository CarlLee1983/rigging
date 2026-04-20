'use strict';

const path = require('path');

// D-09: Whitelist of text file extensions that get name substitution applied.
// Binary files and other extensions are copied verbatim.
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.json', '.md',
  '.yml', '.yaml', '.toml', '.sql', '.txt'
]);

/**
 * Returns true if the file at filePath should have text substitution applied.
 * Matches: TEXT_EXTENSIONS, and .env* files (e.g. .env.example, .env.local).
 * Returns false for: .lock, .png, .ico, .woff2, and other binary/unknown extensions.
 */
function isTextFile(filePath) {
  const base = path.basename(filePath);
  // .env* files are text (e.g. .env.example, .env.local, .env.test)
  if (base.startsWith('.env')) return true;
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Capitalizes only the first character of a string.
 * Examples: "rigging" -> "Rigging", "my-app" -> "My-app"
 * (NOT full title case — preserves hyphens and lowercase remainder)
 */
function toTitleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Replaces all occurrences of 'rigging' and 'Rigging' in content with the
 * project name and its title-cased variant respectively (D-07, D-08).
 * @param {string} content - File content as UTF-8 string
 * @param {string} projectName - The target project name (e.g. "my-app")
 * @returns {string} Content with substitutions applied
 */
function substituteProjectName(content, projectName) {
  return content
    .replaceAll('rigging', projectName)
    .replaceAll('Rigging', toTitleCase(projectName));
}

/**
 * Validates a project name for use with create-rigging.
 * Returns { valid: true } or { valid: false, error: string }.
 *
 * Rules (per D-07, Pitfall 7, Security domain path traversal guard):
 * - Must not be empty
 * - Must not equal 'rigging' (reserved — conflicts with template source name)
 * - Must not contain '/' (path separator injection)
 * - Must not contain '..' (path traversal)
 */
function validateProjectName(projectName) {
  if (!projectName || projectName.trim() === '') {
    return { valid: false, error: 'Usage: create-rigging <project-name>' };
  }
  if (projectName === 'rigging') {
    return {
      valid: false,
      error: 'Error: "rigging" conflicts with the template source name. Choose a different project name.'
    };
  }
  if (projectName.includes('/') || projectName.includes('..')) {
    return {
      valid: false,
      error: 'Error: project name cannot contain path separators or "..".'
    };
  }
  return { valid: true };
}

/**
 * Returns true if the current Node.js major version meets the minimum (18+).
 * Accepts an optional versionString for unit testing (defaults to process.versions.node).
 * D-02, D-03: Node >= 18 is required for fs.cpSync and stable fs/promises.
 */
function isNodeVersionSufficient(versionString) {
  const v = versionString !== undefined ? versionString : process.versions.node;
  const major = parseInt(v.split('.')[0], 10);
  return major >= 18;
}

module.exports = {
  isTextFile,
  toTitleCase,
  substituteProjectName,
  validateProjectName,
  isNodeVersionSufficient,
};
