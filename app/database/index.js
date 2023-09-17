const { MongoClient, ServerApiVersion } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

// check the MongoDB URI
if (!MONGODB_URI) {
  throw new Error("Define the MONGODB_URI environmental variable");
}

// check the MongoDB DB
if (!MONGODB_DB) {
  throw new Error("Define the MONGODB_DB environmental variable");
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  // check the cached.
  if (cachedClient && cachedDb) {
    // load from cache
    return {
      client: cachedClient,
      db: cachedDb,
    };
  }

  // Connect to cluster
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();

  let db = client.db(MONGODB_DB);

  await client
    .db(process.env.MONGODB_ADMIN)
    .command({ ping: 1 })
    .then(
      console.log(
        "Pinged your deployment. You successfully connected to MongoDB!"
      )
    );

  // set cache
  cachedClient = client;
  cachedDb = db;

  return {
    client: cachedClient,
    db: cachedDb,
  };
}

async function saveDoc(value) {
  let { db } = await connectToDatabase();

  const _find = await db
    .collection(process.env.MONGODB_BOT_STATUS)
    .find({ user_id: value })
    .sort({ published: -1 })
    .toArray();

  if (Array.from(_find).length == 0) {
    db.collection(process.env.MONGODB_BOT_STATUS).insertOne({
      user_id: value,
      status: true,
      dateWhenCreated: new Date(),
    });
  }
}

async function deleteDoc(value) {
  let { db } = await connectToDatabase();

  db.collection(process.env.MONGODB_BOT_STATUS).deleteMany({
    user_id: value,
  });
}

module.exports = { connectToDatabase, saveDoc, deleteDoc };
