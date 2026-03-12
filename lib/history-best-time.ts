import { toComparableEventBaseKey } from "./event-key";

type BestTimeSource = {
  id: string;
  timeMs: number;
  meet: { heldOn: Date };
  event: {
    title: string;
    distanceM: number;
  };
};

function toEventBaseKey(source: BestTimeSource): string {
  return toComparableEventBaseKey({
    title: source.event.title,
    distanceM: source.event.distanceM
  });
}

function shouldReplaceCurrentBest(current: BestTimeSource, candidate: BestTimeSource): boolean {
  if (candidate.timeMs < current.timeMs) {
    return true;
  }

  if (candidate.timeMs > current.timeMs) {
    return false;
  }

  const candidateHeldOn = candidate.meet.heldOn.getTime();
  const currentHeldOn = current.meet.heldOn.getTime();

  if (candidateHeldOn > currentHeldOn) {
    return true;
  }

  if (candidateHeldOn < currentHeldOn) {
    return false;
  }

  return candidate.id.localeCompare(current.id, "en") < 0;
}

export function pickBestTimesByEventBase<T extends BestTimeSource>(results: T[]): T[] {
  const bestByEventBase = new Map<string, T>();

  for (const result of results) {
    const key = toEventBaseKey(result);
    const current = bestByEventBase.get(key);

    if (!current || shouldReplaceCurrentBest(current, result)) {
      bestByEventBase.set(key, result);
    }
  }

  return Array.from(bestByEventBase.values()).sort((a, b) => {
    const titleOrder = a.event.title.localeCompare(b.event.title, "ja");
    if (titleOrder !== 0) {
      return titleOrder;
    }

    if (a.event.distanceM !== b.event.distanceM) {
      return a.event.distanceM - b.event.distanceM;
    }

    return b.meet.heldOn.getTime() - a.meet.heldOn.getTime();
  });
}
