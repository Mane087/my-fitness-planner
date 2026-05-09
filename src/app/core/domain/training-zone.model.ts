export interface TrainingZoneEntity {
  id: string;
  name: string;
  description?: string;
  minHeartRate: number;
  maxHeartRate: number;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingZoneSnapshot {
  id: string;
  name: string;
  minHeartRate: number;
  maxHeartRate: number;
}
