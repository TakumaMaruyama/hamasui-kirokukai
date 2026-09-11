export type SwimmingDocumentKind = "records" | "certificates" | "historical-firsts";

export type SwimmingDocumentPreview = {
  kind: SwimmingDocumentKind;
  filename: string;
  counts: { people?: number; pages?: number; records: number; events?: number };
  items: Array<{
    name: string;
    gradeLabel: string;
    genderLabel: string;
    weekday?: string;
    entries: Array<{
      eventTitle: string;
      timeText: string;
      recordMonthLabel?: string;
      isNewRecordInTargetMonth?: boolean;
    }>;
  }>;
};

export type SwimmingDocumentMonth = { year: number; month: number };
