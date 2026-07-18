import { MongoClient } from 'mongodb';

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
