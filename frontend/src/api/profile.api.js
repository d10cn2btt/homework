import api from './axios';

export const getProfile = () => api.get('/profile');
export const updateProfile = (data) => api.put('/profile', data);
