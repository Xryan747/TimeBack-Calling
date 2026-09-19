import { getServerUrl } from './config';

function getBase() {
  return getServerUrl();
}

async function request(url, options = {}) {
  const res = await fetch(`${getBase()}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data.data;
}

// Upload
export async function uploadPhoto(file) {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch(`${getBase()}/api/upload/photo`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
  return data.data;
}

export async function uploadAudio(file) {
  const form = new FormData();
  form.append('audio', file);
  const res = await fetch(`${getBase()}/api/upload/audio`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
  return data.data;
}

// Personas
export async function createPersona({ name, photoPath, audioPath, chatLogs }) {
  return request('/api/personas', {
    method: 'POST',
    body: JSON.stringify({ name, photoPath, audioPath, chatLogs }),
  });
}

export async function listPersonas() {
  return request('/api/personas');
}

export async function getPersona(id) {
  return request(`/api/personas/${id}`);
}

export async function deletePersona(id) {
  return request(`/api/personas/${id}`, { method: 'DELETE' });
}

export async function getCallHistory(personaId) {
  return request(`/api/personas/${personaId}/calls`);
}

export async function getMessages(personaId) {
  return request(`/api/personas/${personaId}/messages`);
}

// App settings (payment QR + instructions in 服务)
export async function getSettings() {
  return request('/api/settings');
}

export async function updateSettings(patch) {
  return request('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
}
