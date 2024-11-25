// interfaces/soilData.ts

export interface SoilData {
    id: string;
    EC: number;
    date_time: Date; // Date object after conversion
    humidity: number;
    moisture: number;
    nitrogen: number;
    pH: number;
    phosphorus: number;
    potassium: number;
    temperature: number;
  }
  