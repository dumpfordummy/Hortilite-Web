// utils/typeGuards.ts

import { LightData } from '../interfaces/lightData';

export const isLightData = (data: any): data is LightData => {
  return (
    typeof data.id === 'string' &&
    typeof data.start_time === 'number' &&
    typeof data.end_time === 'number'
  );
};
