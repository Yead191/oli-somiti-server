import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);

let collections = {};

async function connectDB() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const db = client.db("SomitiDB");

    // Send a ping to confirm a successful connection
    // await client.db().command({ ping: 1 });
    // console.log("Successfully connected to MongoDB!");

    collections = {
      users: db.collection("users"),
      transactions: db.collection("transactions"),
    };

    return collections;
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
export { connectDB, collections };
