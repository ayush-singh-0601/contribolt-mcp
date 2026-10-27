export const NODE_REQUIREMENT = 'Node.js 22.13+ (22.x) or 24+';

export function supportedRuntime(version = process.versions.node): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const major = Number(match[1]),
    minor = Number(match[2]);
  return (major === 22 && minor >= 13) || major >= 24;
}
