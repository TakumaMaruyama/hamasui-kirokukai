import type { HomeMeetComparisonCard } from "./home-meet-summary";
import { formatMeetLabel } from "./meet-context";

export type HomeProgressHeader = {
  slotLabel: HomeMeetComparisonCard["slotLabel"];
  currentLabel: string;
  comparisonLabel: string;
};

export function getHomeProgressHeader(card: HomeMeetComparisonCard): HomeProgressHeader {
  if (card.currentMeet && card.previousMeet) {
    return {
      slotLabel: card.slotLabel,
      currentLabel: formatMeetLabel(card.currentMeet),
      comparisonLabel: `前回比較: ${formatMeetLabel(card.previousMeet)}`
    };
  }

  if (card.currentMeet) {
    return {
      slotLabel: card.slotLabel,
      currentLabel: formatMeetLabel(card.currentMeet),
      comparisonLabel: "次回の記録会が入ると比較を表示"
    };
  }

  return {
    slotLabel: card.slotLabel,
    currentLabel: "比較準備中",
    comparisonLabel: "さらに前の記録会が入ると表示"
  };
}
