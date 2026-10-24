export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const SEARCH_MIN = 2;
export const DISPLAY_NAME_MAX = 60;
export const BIO_MAX = 160;
export const TIMELINE_NAME_MAX = 60;
export const TIMELINE_DESCRIPTION_MAX = 280;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type FriendLink = {
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "declined";
};

export type FriendAction = "self" | "blocked" | "friends" | "incoming" | "outgoing" | "add";

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function usernameError(value: string): string | null {
  if (!USERNAME_PATTERN.test(value.trim().toLowerCase())) {
    return "Usernames use 3 to 20 lowercase letters, numbers, or underscores.";
  }
  return null;
}

export function displayNameError(value: string): string | null {
  const name = value.trim();
  if (CONTROL_CHARS.test(value) || name.length < 1 || name.length > DISPLAY_NAME_MAX) {
    return "Display names need 1 to 60 characters.";
  }
  return null;
}

export function bioError(value: string): string | null {
  const bio = value.trim();
  if (CONTROL_CHARS.test(value) || bio.length > BIO_MAX) {
    return "Bios can be up to 160 characters.";
  }
  return null;
}

export function timelineNameError(value: string): string | null {
  const name = value.trim();
  if (CONTROL_CHARS.test(value) || name.length < 1 || name.length > TIMELINE_NAME_MAX) {
    return "Timeline names need 1 to 60 characters.";
  }
  return null;
}

export function timelineDescriptionError(value: string): string | null {
  const description = value.trim();
  if (CONTROL_CHARS.test(value) || description.length > TIMELINE_DESCRIPTION_MAX) {
    return "Descriptions can be up to 280 characters.";
  }
  return null;
}

export function searchQueryError(value: string): string | null {
  const query = value.trim();
  if (query.length < SEARCH_MIN) return "Type at least 2 characters.";
  if (query.length > 40 || CONTROL_CHARS.test(value)) return "Try a shorter name or username.";
  return null;
}

export function friendAction(
  me: string,
  target: string,
  links: FriendLink[],
  blockedIds: string[],
): FriendAction {
  if (me === target) return "self";
  if (blockedIds.includes(target)) return "blocked";
  const link = links.find((item) => item.requesterId === target || item.addresseeId === target);
  if (!link || link.status === "declined") return "add";
  if (link.status === "accepted") return "friends";
  if (link.requesterId === me) return "outgoing";
  return "incoming";
}

export function safeSocialHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\") || href.includes("?")) {
    return "/notifications";
  }
  const allowed = /^\/(friends|shared|notifications|profile)(\/[A-Za-z0-9_-]+)?$/;
  return allowed.test(href) ? href : "/notifications";
}

export function avatarObjectPath(userId: string): string {
  return `${userId.toLowerCase()}/avatar.jpg`;
}

export function isAvatarPath(userId: string, path: string): boolean {
  return path.toLowerCase() === avatarObjectPath(userId);
}

export function coverObjectPath(ownerId: string, timelineId: string): string {
  return `${ownerId.toLowerCase()}/${timelineId.toLowerCase()}.jpg`;
}

export function isCoverPath(ownerId: string, timelineId: string, path: string): boolean {
  return path.toLowerCase() === coverObjectPath(ownerId, timelineId);
}

export const AVATAR_BUCKET = "profile-avatars";
export const COVER_BUCKET = "timeline-covers";

export function profilePhotoSrc(userId: string, revision = 0): string {
  const base = `/api/profile-photo?user=${encodeURIComponent(userId)}`;
  return revision > 0 ? `${base}&v=${revision}` : base;
}

export function coverPhotoSrc(timelineId: string): string {
  return `/api/timeline-cover?timeline=${encodeURIComponent(timelineId)}`;
}

export function sharedPhotoSrc(entryId: string): string {
  return `/api/shared-photo?entry=${encodeURIComponent(entryId)}`;
}
