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
