// interfaces/soil.ts

import { SoilData } from './soilData';

export interface SoilDocument {
  id: string;
  data: SoilData[];
}
