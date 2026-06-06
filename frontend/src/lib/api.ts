const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

export const apiClient = {
  testSmtp: (data: any) => api('/api/test-smtp', { method: 'POST', body: JSON.stringify(data) }),
  sendCampaign: (campaignId: string) => api('/api/send-campaign', { method: 'POST', body: JSON.stringify({ campaignId }) }),
  createUser: (data: any) => api('/api/users', { method: 'POST', body: JSON.stringify(data) }),
};
