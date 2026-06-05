let cachedHealth = null;

export async function getServerHealth({ refresh = false } = {}) {
  if (cachedHealth && !refresh) return cachedHealth;
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
    cachedHealth = await response.json();
  } catch {
    cachedHealth = { ok: false, hasOpenAIKey: false };
  }
  return cachedHealth;
}

export async function hasServerOpenAIKey() {
  const health = await getServerHealth();
  return Boolean(health.ok && health.hasOpenAIKey);
}
