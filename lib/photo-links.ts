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
