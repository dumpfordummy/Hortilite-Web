// interfaces/lightData.ts

export interface LightData {
    id: string;
    start_time: number;
    end_time: number;
  }
  

export interface ProcessedLightData {
    id: string;
    startTime: string;
    endTime: string;
    duration: number; // Duration in minutes
  } 