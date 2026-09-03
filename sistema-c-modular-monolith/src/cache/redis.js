import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
client.on('error', (err) => console.error('Redis error', err));

let connecting = null;

export async function getRedis() {
  if (!client.isOpen) {
    connecting = connecting || client.connect();
    await connecting;
  }
  return client;
}
