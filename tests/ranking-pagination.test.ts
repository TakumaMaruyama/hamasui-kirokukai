import { describe, expect, it } from "vitest";
import { paginateRankingGroups } from "../lib/ranking-pagination";
import type { RankingGroup } from "../lib/ranking-report";

function buildGroup(eventId: string, entryCount: number): RankingGroup {
  return {
    eventId,
    eventTitle: `${eventId}種目`,
    grade: 3,
    gender: "male",
    entries: Array.from({ length: entryCount }, (_, index) => ({
      rank: index + 1,
      fullName: `name-${index + 1}`,
      timeText: `00:${String(index + 1).padStart(2, "0")}.00`
    }))
  };
}

describe("paginateRankingGroups", () => {
  it("keeps a single chunk at maxEntriesPerBlock boundary", () => {
    const pages = paginateRankingGroups([buildGroup("e1", 3)], {
      maxEntriesPerBlock: 3,
      maxRowsPerPage: 20
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]?.blocks).toHaveLength(1);
    expect(pages[0]?.blocks[0]?.chunkCount).toBe(1);
    expect(pages[0]?.blocks[0]?.entries).toHaveLength(3);
  });

  it("splits into two chunks when one over maxEntriesPerBlock", () => {
    const pages = paginateRankingGroups([buildGroup("e1", 4)], {
      maxEntriesPerBlock: 3,
      maxRowsPerPage: 20
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]?.blocks).toHaveLength(2);
    expect(pages[0]?.blocks[0]?.chunkIndex).toBe(1);
    expect(pages[0]?.blocks[0]?.chunkCount).toBe(2);
    expect(pages[0]?.blocks[0]?.entries).toHaveLength(3);
    expect(pages[0]?.blocks[1]?.chunkIndex).toBe(2);
    expect(pages[0]?.blocks[1]?.chunkCount).toBe(2);
    expect(pages[0]?.blocks[1]?.entries).toHaveLength(1);
  });

  it("creates multiple pages when row budget is exceeded", () => {
    const pages = paginateRankingGroups([buildGroup("e1", 3), buildGroup("e2", 3)], {
      maxEntriesPerBlock: 3,
      maxRowsPerPage: 7,
      headerRowsPerBlock: 2
    });

    expect(pages).toHaveLength(2);
    expect(pages[0]?.blocks.map((block) => block.eventId)).toEqual(["e1"]);
    expect(pages[1]?.blocks.map((block) => block.eventId)).toEqual(["e2"]);
  });
});
