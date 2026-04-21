export function isTextFile(filePath: string): boolean
export function toTitleCase(s: string): string
export function substituteProjectName(content: string, projectName: string): string
export function validateProjectName(
  projectName: string,
): { valid: true } | { valid: false; error: string }
export function isNodeVersionSufficient(versionString?: string): boolean
