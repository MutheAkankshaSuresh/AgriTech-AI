import axios from 'axios';

const API_URL =
  process.env.REACT_APP_API_URL ||
  'https://agritech-backend-xa6q.onrender.com';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
};

export const seedsAPI = {
  getBatches: (params) => api.get('/api/seeds/batches', { params }),
  getBatch: (id) => api.get(`/api/seeds/batches/${id}`),
  createBatch: (data) => api.post('/api/seeds/batches', data),
  deleteBatch: (batchId) => api.delete(`/api/seeds/batches/${batchId}`),
  predict: (data) => api.post('/api/seeds/predict', data),
  analyzeImage: (file, batchId) => {
    const form = new FormData();
    form.append('file', file);
    if (batchId) form.append('batch_id', batchId);
    return api.post('/api/seeds/analyze-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  analyzeBatchImage: (batchId, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/api/seeds/batches/${batchId}/analyze-image`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getPredictionHistory: (params) => api.get('/api/seeds/prediction-history', { params }),
  getImageHistory: (params) => api.get('/api/seeds/image-history', { params }),
  deletePrediction: (id) => api.delete(`/api/seeds/prediction-history/${encodeURIComponent(id)}`),
  deleteImageAnalysis: (id) => api.delete(`/api/seeds/image-history/${encodeURIComponent(id)}`),
  getBatchReport: (batchId) => api.get(`/api/seeds/batches/${batchId}/report`),
  getPredictionReport: (logId) => api.get(`/api/seeds/prediction-history/${encodeURIComponent(logId)}/report`),
  getImageReport: (logId) => api.get(`/api/seeds/image-history/${encodeURIComponent(logId)}/report`),
  getStats: () => api.get('/api/seeds/stats'),
  getGPTrend: () => api.get('/api/seeds/gp-trend'),
  ingestIotData: (data) => api.post('/api/seeds/iot/ingest', data),
  getLatestIotData: (deviceId) => api.get('/api/seeds/iot/latest', { params: deviceId ? { device_id: deviceId } : {} }),
  getIotHistory: (params) => api.get('/api/seeds/iot/history', { params }),
  ingestChamberAReading: (data) => api.post('/api/seeds/iot/chamber-a/readings', data),
  getLatestChamberAReading: (deviceId) => api.get('/api/seeds/iot/chamber-a/latest', { params: deviceId ? { device_id: deviceId } : {} }),
  getChamberAHistory: (params) => api.get('/api/seeds/iot/chamber-a/history', { params }),
  ingestChamberBImage: (data) => api.post('/api/seeds/iot/chamber-b/images', data),
  getLatestChamberBImage: (deviceId) => api.get('/api/seeds/iot/chamber-b/latest', { params: deviceId ? { device_id: deviceId } : {} }),
  getChamberBHistory: (params) => api.get('/api/seeds/iot/chamber-b/history', { params }),
  forecastGP: (data) => api.post('/api/seeds/forecast', data),
};

export const dashboardAPI = {
  getStats: () => api.get('/api/dashboard/stats'),
};

export const alertsAPI = {
  getAlerts: (params) => api.get('/api/alerts/', { params }),
  resolveAlert: (id) => api.patch(`/api/alerts/${id}/resolve`),
};

export const waterAPI = {
  getStats: () => api.get('/api/water/stats'),
  getHistory: (params) => api.get('/api/water/history', { params }),
  getAdvice: (data) => api.post('/api/water/irrigation-advice', data),
  getReport: (id) => api.get(`/api/water/history/${encodeURIComponent(id)}/report`),
  deleteEntry: (id) => api.delete(`/api/water/history/${encodeURIComponent(id)}`),
};

export const precisionAPI = {
  getStats: () => api.get('/api/precision/stats'),
  getHistory: (params) => api.get('/api/precision/history', { params }),
  analyzeField: (data) => api.post('/api/precision/field-analysis', data),
  getReport: (id) => api.get(`/api/precision/history/${encodeURIComponent(id)}/report`),
  deleteEntry: (id) => api.delete(`/api/precision/history/${encodeURIComponent(id)}`),
};

export const climateAPI = {
  getStats: () => api.get('/api/climate/stats'),
  getHistory: (params) => api.get('/api/climate/history', { params }),
  getPlan: (data) => api.post('/api/climate/resilience-plan', data),
  getReport: (id) => api.get(`/api/climate/history/${encodeURIComponent(id)}/report`),
  deleteEntry: (id) => api.delete(`/api/climate/history/${encodeURIComponent(id)}`),
};

export default api;
