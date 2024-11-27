// utils/timeUtils.ts

import { ProcessedLightData } from '../interfaces/lightData'; // Adjust the path as necessary

export interface TimeInterval {
  start: number; // in HHMM format
  end: number;   // in HHMM format
}

/**
 * Checks if two time intervals overlap.
 * @param interval1 First time interval.
 * @param interval2 Second time interval.
 * @returns True if they overlap, false otherwise.
 */
export const isOverlapping = (interval1: TimeInterval, interval2: TimeInterval): boolean => {
  return interval1.start < interval2.end && interval2.start < interval1.end;
};

/**
 * Checks if a new time interval conflicts with existing intervals.
 * @param existingIntervals Array of existing time intervals.
 * @param newInterval The new time interval to check.
 * @param excludeId Optional record ID to exclude from the check (useful during editing).
 * @param records Array of existing records.
 * @returns True if there's a conflict, false otherwise.
 */
export const hasConflict = (
  existingIntervals: TimeInterval[],
  newInterval: TimeInterval,
  excludeId: string | null = null,
  records: ProcessedLightData[] = []
): boolean => {
  for (let i = 0; i < existingIntervals.length; i++) {
    const existingInterval = existingIntervals[i];
    const recordId = records[i]?.id;

    if (excludeId && recordId === excludeId) {
      continue; // Skip the record being edited
    }

    if (isOverlapping(existingInterval, newInterval)) {
      return true;
    }
  }
  return false;
};
