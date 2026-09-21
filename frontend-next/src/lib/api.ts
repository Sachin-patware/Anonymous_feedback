import API_BASE_URL from '@/config';

/**
 * Enhanced fetch wrapper that always includes credentials and handles base URL.
 * Mandatory for cross-domain authentication between Vercel and Render.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    // Ensure endpoint starts with a slash
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${path}`;

    const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Add JWT token if it exists in localStorage
    if (typeof window !== 'undefined') {
        let token: string | null = null;
        if (path.startsWith('/dashboard-admin/')) {
            token = localStorage.getItem('access_token');
        } else if (
            path.startsWith('/my-teachers') ||
            path.startsWith('/submit-feedback') ||
            path.startsWith('/my-feedbacks')
        ) {
            token = localStorage.getItem('student_token') || localStorage.getItem('access_token');
        } else {
            token = localStorage.getItem('student_token') || localStorage.getItem('access_token');
        }

        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }
    }

    // Merge headers
    const headers = {
        ...defaultHeaders,
        ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
        cache: 'no-store',
        ...options,
        headers,
    });

    // Safely intercept .json() so HTML error pages (404/500/HTML) don't crash with JSON parse syntax error
    const rawJson = response.json.bind(response);
    response.json = async () => {
        try {
            const text = await response.text();
            if (!text || !text.trim()) {
                return { status: response.ok ? 'ok' : 'error', error: response.ok ? undefined : `HTTP ${response.status}` };
            }
            try {
                return JSON.parse(text);
            } catch {
                return {
                    status: 'error',
                    error: `Server returned non-JSON response (${response.status} ${response.statusText || 'Error'}). Please check backend connection.`
                };
            }
        } catch (e: any) {
            return {
                status: 'error',
                error: e?.message || 'Failed to read response body.'
            };
        }
    };

    return response;
}
