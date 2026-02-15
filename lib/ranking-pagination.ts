import type { RankingEntry, RankingGroup } from "./ranking-report";

export type RankingPageBlock = {
  eventId: string;
  eventTitle: string;
  grade: number;
  gender: RankingGroup["gender"];
  entries: RankingEntry[];
  chunkIndex: number;
  chunkCount: number;
};

export type RankingPage = {
  blocks: RankingPageBlock[];
};

type PaginationOptions = {
  maxEntriesPerBlock?: number;
  maxRowsPerPage?: number;
  headerRowsPerBlock?: number;
};

const DEFAULT_MAX_ENTRIES_PER_BLOCK = 18;
const DEFAULT_MAX_ROWS_PER_PAGE = 32;
const DEFAULT_HEADER_ROWS_PER_BLOCK = 2;

function chunkEntries(entries: RankingEntry[], chunkSize: number): RankingEntry[][] {
  const chunks: RankingEntry[][] = [];

  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize));
  }

  return chunks.length > 0 ? chunks : [[]];
}

export function paginateRankingGroups(
  groups: RankingGroup[],
  options: PaginationOptions = {}
): RankingPage[] {
  const maxEntriesPerBlock = Math.max(1, options.maxEntriesPerBlock ?? DEFAULT_MAX_ENTRIES_PER_BLOCK);
  const maxRowsPerPage = Math.max(1, options.maxRowsPerPage ?? DEFAULT_MAX_ROWS_PER_PAGE);
  const headerRowsPerBlock = Math.max(1, options.headerRowsPerBlock ?? DEFAULT_HEADER_ROWS_PER_BLOCK);

  const blocks: RankingPageBlock[] = [];

  for (const group of groups) {
    const entryChunks = chunkEntries(group.entries, maxEntriesPerBlock);
    const chunkCount = entryChunks.length;

    for (let index = 0; index < chunkCount; index++) {
      blocks.push({
        eventId: group.eventId,
        eventTitle: group.eventTitle,
        grade: group.grade,
        gender: group.gender,
        entries: entryChunks[index] ?? [],
        chunkIndex: index + 1,
        chunkCount
      });
    }
  }

  const pages: RankingPage[] = [];
  let currentPage: RankingPage = { blocks: [] };
  let currentRows = 0;

  for (const block of blocks) {
    const blockRows = headerRowsPerBlock + block.entries.length;
    const shouldBreakPage = currentPage.blocks.length > 0 && currentRows + blockRows > maxRowsPerPage;

    if (shouldBreakPage) {
      pages.push(currentPage);
      currentPage = { blocks: [] };
      currentRows = 0;
    }

    currentPage.blocks.push(block);
    currentRows += blockRows;
  }

  if (currentPage.blocks.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}
