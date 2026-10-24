export const CUSTOM_FEELING_LIMIT = 60;

export function parseCustomFeeling(
  value: string | null,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === null) return { ok: true, value: null };
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) {
    return { ok: false, message: "Enter a feeling, or clear the custom option." };
  }
  if (text.length > CUSTOM_FEELING_LIMIT) {
    return { ok: false, message: `Keep a custom feeling to ${CUSTOM_FEELING_LIMIT} characters.` };
  }
  if (/[\u0000-\u001f]/.test(text) || /https?:\/\/|www\./i.test(text)) {
    return { ok: false, message: "Use words for a feeling. Leave out links." };
  }
  if (!/[\p{L}\p{N}]/u.test(text)) {
    return { ok: false, message: "Use words for a feeling." };
  }
  return { ok: true, value: text };
}
