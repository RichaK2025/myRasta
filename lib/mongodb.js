import dns from 'dns';
import { MongoClient } from 'mongodb';

// Node 18+ resolves DNS IPv6-first by default. Netlify's serverless functions
// (AWS Lambda under the hood) don't reliably support outbound IPv6, so the
// connection attempt to Atlas fails at the network layer — but because it
// fails mid-TLS-handshake, it surfaces as a confusing
// "SSL routines:ssl3_read_bytes:tlsv1 alert internal error" instead of a
// clear connection error. Forcing IPv4-first resolution avoids the broken
// path entirely. Harmless locally/anywhere IPv6 works fine.
dns.setDefaultResultOrder('ipv4first');

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'raasta';

const clientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  // Close idle sockets well before Atlas's own idle timeout would. Lambda
  // freezes the whole process between invocations; if the server drops a
  // connection while we're frozen, resuming on it produces the same
  // confusing TLS "internal error" alert instead of a clean disconnect.
  maxIdleTimeMS: 10000,
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 20000,
};

function createClientPromise() {
  const client = new MongoClient(uri, clientOptions);
  return client.connect();
}

export async function getDb() {
  if (!uri) {
    throw new Error('Missing MONGO_URL');
  }

  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createClientPromise();
  }

  try {
    const c = await global._mongoClientPromise;
    // Cheap liveness check on the cached connection. Catches the case where
    // the server already dropped our socket while this function was frozen
    // between invocations — without this, the first real query after a
    // freeze fails with a generic TLS alert instead of reconnecting cleanly.
    await c.db('admin').command({ ping: 1 });
    return c.db(dbName);
  } catch (err) {
    console.warn('Cached MongoDB connection failed health check, reconnecting:', err.message);
    global._mongoClientPromise = createClientPromise();
    const c = await global._mongoClientPromise;
    return c.db(dbName);
  }
}
