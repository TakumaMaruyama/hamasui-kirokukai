import { parse } from "csv-parse/sync";

export type CsvRow = {
  meet_title: string;
  held_on: string;
  full_name: string;
  grade: string;
  gender: string;
  event_title: string;
  style: string;
  distance_m: string;
  lane?: string;
  time_text: string;
};

export function parseCsv(content: string): CsvRow[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as CsvRow[];
}
