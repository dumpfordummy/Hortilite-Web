// interfaces/soilData.ts

export interface SoilData {
    id: string;
    EC: number;
    date_time: Date; // Date object after conversion
    Humidity: number;
    Moisture: number;
    Nitrogen: number;
    pH: number;
    Phosphorus: number;
    Potassium: number;
    Temperature: number;
  }
  