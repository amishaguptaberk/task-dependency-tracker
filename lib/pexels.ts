// One fetch with a timeout and a catch. Never throws, never logs the key.
export async function fetchTaskImage(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`,
      {
        headers: { Authorization: key },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.photos?.[0]?.src?.medium ?? null;
  } catch {
    return null;
  }
}
