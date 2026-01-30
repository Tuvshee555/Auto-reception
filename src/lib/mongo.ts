import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "";
if (!uri) throw new Error("MONGODB_URI not set");

let client: MongoClient | null = null;
let promise: Promise<MongoClient> | null = null;

export async function getMongoClient() {
  if (client) return client;
  if (!promise) promise = MongoClient.connect(uri);
  client = await promise;
  return client;
}

export async function getDb() {
  const c = await getMongoClient();
  return c.db();
}
