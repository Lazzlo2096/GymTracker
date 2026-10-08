import { apiFetch, parseErrorDetail } from "@/api/client";

export type UserWeightCreateBody = {
  user_id: number;
  weight_kg: number;
  body_fat_percent?: number | null;
  measured_at?: string;
  note?: string | null;
};

export type UserWeightUpdateBody = {
  weight_kg?: number;
  body_fat_percent?: number | null;
  measured_at?: string;
  note?: string | null;
};

export async function createUserWeight(body: UserWeightCreateBody): Promise<number> {
  const response = await apiFetch("/api/v1/user_weights/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(parseErrorDetail(data));
  }
  const id = (data as { id?: unknown })?.id;
  if (typeof id !== "number" || !Number.isInteger(id)) {
    throw new Error("Некорректный ответ сервера");
  }
  return id;
}

export async function updateUserWeight(id: number, body: UserWeightUpdateBody): Promise<void> {
  const response = await apiFetch(`/api/v1/user_weights/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(data));
  }
}

export async function deleteUserWeight(id: number): Promise<void> {
  const response = await apiFetch(`/api/v1/user_weights/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(parseErrorDetail(data));
  }
}
