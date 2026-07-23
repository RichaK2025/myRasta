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

// Community alerts are meant to self-delete once expired rather than
// accumulate as permanent history — a TTL index makes MongoDB do that
// natively (a background sweep, no cron/extra reads/writes from the app).
// Guarded by a global flag so this only runs once per warm server instance,
// not on every request.
async function ensureIndexes(db) {
  if (global._raastaIndexesEnsured) return;
  global._raastaIndexesEnsured = true;
  try {
    await db.collection('community_alerts').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    await db.collection('community_alerts').createIndex({ lat: 1, lng: 1 });
    // Plain indexes only — no Atlas Search index configuration involved
    // (that requires the Atlas UI). Cover the fields search/Explore/
    // Leaderboards actually filter or sort by.
    await db.collection('routes').createIndex({ name: 1 });
    await db.collection('routes').createIndex({ city: 1, is_public: 1 });
    await db.collection('routes').createIndex({ tags: 1 });
    await db.collection('routes').createIndex({ route_type: 1 });
    await db.collection('routes').createIndex({ popularity_score: -1 });
    // Live trips are inherently transient (a status pointer, not a track) —
    // auto-clear one if the app closes/crashes without an explicit stop.
    await db.collection('live_trips').createIndex({ updated_at: 1 }, { expireAfterSeconds: 7200 });
    // Backs the Home screen's Community Activity feed (recency-sorted reads
    // over data these collections already store — no new writes).
    await db.collection('verifications').createIndex({ created_at: -1 });
    await db.collection('route_notes').createIndex({ created_at: -1 });
  } catch (err) {
    console.warn('Index setup failed (non-fatal):', err.message);
    global._raastaIndexesEnsured = false; // allow retry on next call
  }
}

export async function getDb() {
  if (!uri) {
    throw new Error('Missing MONGO_URL');
  }

  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createClientPromise();
  }

  let db;
  try {
    const c = await global._mongoClientPromise;
    // Cheap liveness check on the cached connection. Catches the case where
    // the server already dropped our socket while this function was frozen
    // between invocations — without this, the first real query after a
    // freeze fails with a generic TLS alert instead of reconnecting cleanly.
    await c.db('admin').command({ ping: 1 });
    db = c.db(dbName);
  } catch (err) {
    console.warn('Cached MongoDB connection failed health check, reconnecting:', err.message);
    global._mongoClientPromise = createClientPromise();
    const c = await global._mongoClientPromise;
    db = c.db(dbName);
  }
  await ensureIndexes(db);
  return db;
}
