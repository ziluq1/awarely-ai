export const PHOTO_BUCKET = "journal-photos";

const OWNED_PHOTO_PATH =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([0-9]+)\.jpg$/i;

export function isOwnedPhotoPath(userId: string, path: string): boolean {
  const match = OWNED_PHOTO_PATH.exec(path);
  return Boolean(match && match[1].toLowerCase() === userId.toLowerCase());
}

export function accountPhotoSrc(path: string): string {
  return `/api/journal-photo?path=${encodeURIComponent(path)}`;
}

export type SignedUrlItem = {
  path: string | null;
  signedUrl: string | null;
  error: string | null;
};

export function associateSignedUrls(
  requested: string[],
  items: SignedUrlItem[] | null,
): { urls: Map<string, string>; missing: string[] } {
  const urls = new Map<string, string>();
  const missing: string[] = [];
  requested.forEach((path, index) => {
    const item = items?.[index];
    const url = item?.signedUrl?.trim() ?? "";
    if (!item || item.error || !url) {
      missing.push(path);
      return;
    }
    urls.set(path, url);
    if (item.path) urls.set(item.path, url);
  });
  return { urls, missing };
}
