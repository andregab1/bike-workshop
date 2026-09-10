export async function getApiData<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar os dados.");
  return body.data as T;
}
