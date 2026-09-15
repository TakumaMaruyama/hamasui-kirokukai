import type { ChallengeEventRankingGroup } from "./ranking-report";

export type ChallengeDocumentMonth = { year: number; month: number };

export type ChallengeRankingPreview = {
  filename: string;
  counts: { records: number; events: number };
  groups: ChallengeEventRankingGroup[];
};
