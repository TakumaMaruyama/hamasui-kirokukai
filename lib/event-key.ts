type EventKeyInput = {
  title: string;
  distanceM: number;
};

export function normalizeComparableEventTitle(value: string): string {
  return value
    .replace(/\u3000/g, " ")
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "")
    .toLowerCase();
}

export function toComparableEventBaseKey(input: EventKeyInput): string {
  return `${normalizeComparableEventTitle(input.title)}:${input.distanceM}`;
}
