export type WeightMeasurement = {
  id: number;
  measured_at: string;
  weight_kg: number;
  body_fat_percent: number | null;
  body_score: number | null;
  note: string | null;
};
