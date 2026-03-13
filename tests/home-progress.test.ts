import { describe, expect, it } from "vitest";
import { getHomeProgressHeader } from "../lib/home-progress";
import type { HomeMeetComparisonCard, HomeMeetOverview } from "../lib/home-meet-summary";

function buildMeetOverview(input: {
  id: string;
  title: string;
  heldOn: string;
}): HomeMeetOverview {
  return {
    id: input.id,
    title: input.title,
    heldOn: new Date(input.heldOn),
    participantCount: 0,
    resultCount: 0
  };
}

function buildCard(
  input: Partial<HomeMeetComparisonCard> & Pick<HomeMeetComparisonCard, "slotLabel" | "state">
): HomeMeetComparisonCard {
  return {
    slotLabel: input.slotLabel,
    state: input.state,
    currentMeet: input.currentMeet ?? null,
    previousMeet: input.previousMeet ?? null,
    totalImprovementMs: input.totalImprovementMs ?? 0,
    comparedEntryCount: input.comparedEntryCount ?? 0,
    improvedEntryCount: input.improvedEntryCount ?? 0
  };
}

describe("getHomeProgressHeader", () => {
  it("shows the current meet and previous comparison for the latest card", () => {
    const header = getHomeProgressHeader(
      buildCard({
        slotLabel: "今回",
        state: "ready",
        currentMeet: buildMeetOverview({
          id: "latest",
          title: "2025年9月（2）",
          heldOn: "2025-09-01T00:00:00.000Z"
        }),
        previousMeet: buildMeetOverview({
          id: "previous",
          title: "2025年3月",
          heldOn: "2025-03-01T00:00:00.000Z"
        })
      })
    );

    expect(header).toEqual({
      slotLabel: "今回",
      currentLabel: "2025年9月 （2）",
      comparisonLabel: "前回比較: 2025年3月"
    });
  });

  it("shows the current and previous meets for the previous slot card", () => {
    const header = getHomeProgressHeader(
      buildCard({
        slotLabel: "1つ前",
        state: "ready",
        currentMeet: buildMeetOverview({
          id: "middle",
          title: "2025年3月",
          heldOn: "2025-03-01T00:00:00.000Z"
        }),
        previousMeet: buildMeetOverview({
          id: "oldest",
          title: "2024年9月木曜",
          heldOn: "2024-09-01T00:00:00.000Z"
        })
      })
    );

    expect(header).toEqual({
      slotLabel: "1つ前",
      currentLabel: "2025年3月",
      comparisonLabel: "前回比較: 2024年9月 木曜"
    });
  });

  it("uses the current meet label and waiting message when the next comparison is not ready", () => {
    const header = getHomeProgressHeader(
      buildCard({
        slotLabel: "今回",
        state: "waiting-next-meet",
        currentMeet: buildMeetOverview({
          id: "current-only",
          title: "2025年9月木曜日",
          heldOn: "2025-09-01T00:00:00.000Z"
        })
      })
    );

    expect(header).toEqual({
      slotLabel: "今回",
      currentLabel: "2025年9月 木曜",
      comparisonLabel: "次回の記録会が入ると比較を表示"
    });
  });

  it("returns a placeholder header when the card is unavailable", () => {
    const header = getHomeProgressHeader(
      buildCard({
        slotLabel: "1つ前",
        state: "unavailable"
      })
    );

    expect(header).toEqual({
      slotLabel: "1つ前",
      currentLabel: "比較準備中",
      comparisonLabel: "さらに前の記録会が入ると表示"
    });
  });
});
