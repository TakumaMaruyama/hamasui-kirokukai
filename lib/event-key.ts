type EventKeyInput = {
  title: string;
  distanceM: number;
};

const COMPARABLE_STYLE_ALIASES: Array<[RegExp, string]> = [
  [/自由形/gu, "free"],
  [/クロール/gu, "free"],
  [/背泳ぎ/gu, "back"],
  [/平泳ぎ/gu, "breast"],
  [/バタフライ/gu, "fly"],
  [/メドレー/gu, "im"],
  [/キック/gu, "kick"]
];

export function normalizeComparableEventTitle(value: string): string {
  let normalized = value
    .replace(/\u3000/g, " ")
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  for (const [pattern, replacement] of COMPARABLE_STYLE_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s/g, "");
}

export function toComparableEventBaseKey(input: EventKeyInput): string {
  return `${normalizeComparableEventTitle(input.title)}:${input.distanceM}`;
}
