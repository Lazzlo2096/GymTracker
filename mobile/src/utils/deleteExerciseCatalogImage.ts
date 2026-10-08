import { apiFetch, parseErrorDetail } from "@/api/client";

export async function deleteExerciseCatalogImage(catalogId: number): Promise<void> {
  const response = await apiFetch(
    `/api/v1/exercises_in_catalog/${catalogId}/image`,
    { method: "DELETE" },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorDetail(payload));
  }
}
