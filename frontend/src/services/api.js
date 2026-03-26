const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const api = {
  // Search
  searchSuggest: async (query) => {
    const res = await fetch(`${API_URL}/api/search/suggest?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search suggest failed');
    return res.json();
  },

  search: async (params) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    const res = await fetch(`${API_URL}/api/search?${searchParams}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  // Company
  getCompanyBySlug: async (slug) => {
    const res = await fetch(`${API_URL}/api/company/slug/${slug}`);
    if (!res.ok) throw new Error('Company not found');
    return res.json();
  },

  getCompanyByCUI: async (cui) => {
    const res = await fetch(`${API_URL}/api/company/cui/${cui}`);
    if (!res.ok) throw new Error('Company not found');
    return res.json();
  },

  // Geo
  getJudete: async () => {
    const res = await fetch(`${API_URL}/api/geo/judete`);
    if (!res.ok) throw new Error('Failed to fetch counties');
    return res.json();
  },

  getLocalitati: async (judet) => {
    const url = judet 
      ? `${API_URL}/api/geo/localitati?judet=${encodeURIComponent(judet)}`
      : `${API_URL}/api/geo/localitati`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch localities');
    return res.json();
  },

  // CAEN
  getTopCaenCodes: async (limit = 50) => {
    const res = await fetch(`${API_URL}/api/caen/top?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch CAEN codes');
    return res.json();
  },

  // Stats
  getStats: async () => {
    const res = await fetch(`${API_URL}/api/stats/overview`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },
};

export default api;