/**
 * LiveTalking Avatar Service
 * Uploads video → LiveTalking creates avatar → returns avatar_id
 */

const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

const LT_URL = 'http://localhost:8010';

async function createAvatar(videoPath, avatarName, model = 'wav2lip') {
  // Sanitize avatar name: no spaces, no special chars
  const avatarId = avatarName.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_');

  const form = new FormData();
  form.append('model', model);
  form.append('avatar_id', avatarId);
  form.append('video_file', fs.createReadStream(videoPath));
  form.append('img_size', '256');

  const resp = await fetch(`${LT_URL}/api/avatar/task`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  const data = await resp.json();
  if (data.code !== 0) throw new Error(`LiveTalking avatar error: ${data.msg}`);

  console.log(`[LT Avatar] Task created: ${data.data.task_id}, avatar: ${avatarId}`);
  return { taskId: data.data.task_id, avatarId };
}

async function pollTask(taskId, maxWait = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await sleep(2000);
    const resp = await fetch(`${LT_URL}/api/avatar/task/${taskId}`);
    const data = await resp.json();
    if (data.code !== 0) throw new Error(`Poll error: ${data.msg}`);

    const task = data.data;
    console.log(`[LT Avatar] ${taskId}: ${task.status} (${task.progress || 0}%)`);
    if (task.status === 'completed') return task;
    if (task.status === 'failed') throw new Error(`Avatar creation failed: ${task.error}`);
  }
  throw new Error('Avatar creation timeout');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { createAvatar, pollTask };
