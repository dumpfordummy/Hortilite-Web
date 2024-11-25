// interfaces/device.ts

export interface Device {
    name: string;
    category: string;
    status: 'online' | 'offline';
  }
  