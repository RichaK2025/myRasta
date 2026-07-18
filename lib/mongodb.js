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

let client;
let clientPromise;

if (uri) {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = null;
}

export async function getDb() {
  if (!clientPromise) {
    throw new Error('Missing MONGO_URL');
  }
  const c = await clientPromise;
  return c.db(dbName);
}
