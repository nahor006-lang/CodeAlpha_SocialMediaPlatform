export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('knot_token');
  const urlString = typeof input === 'string'
    ? input
    : (input instanceof URL ? input.toString() : (input as Request).url || '');

  let newInit: RequestInit = { ...init };
  const headers = new Headers(init?.headers || {});

  if (token && (urlString.startsWith('/api/') || urlString.includes('/api/'))) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  newInit.headers = headers;

  const response = await fetch(input, newInit);

  if (urlString.includes('/api/auth/login') || urlString.includes('/api/auth/register')) {
    try {
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      if (data.token) {
        localStorage.setItem('knot_token', data.token);
      }
    } catch (e) {
      console.error('Error auto-saving auth token:', e);
    }
  } else if (urlString.includes('/api/auth/logout') || response.status === 401) {
    localStorage.removeItem('knot_token');
  }

  return response;
}
