const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return `${API_BASE}${path}`;
}

export { API_BASE };
