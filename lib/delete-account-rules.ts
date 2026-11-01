export const DELETE_CONFIRMATION = "DELETE";

export function ownedStoragePaths(userId: string, names: string[]): string[] {
  const id = userId.trim().toLowerCase();
  if (!id) return [];
  const prefix = `${id}/`;
  const paths: string[] = [];
  for (const name of names) {
    const file = name.trim();
    if (!file || file.includes("/") || file.includes("\\") || file.includes("..")) continue;
    paths.push(`${prefix}${file}`);
  }
  return paths;
}

/** Only allow storage object paths under the user's own folder. */
export function isOwnedObjectPath(userId: string, path: string): boolean {
  const id = userId.trim().toLowerCase();
  if (!id) return false;
  const normalized = path.trim().replace(/^\/+/, "").toLowerCase();
  if (!normalized.startsWith(`${id}/`)) return false;
  if (normalized.includes("..") || normalized.includes("\\")) return false;
  return normalized.length > id.length + 1;
}

export function uniqueOwnedPaths(userId: string, paths: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    if (!path || !isOwnedObjectPath(userId, path)) continue;
    const key = path.trim().replace(/^\/+/, "");
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out;
}
