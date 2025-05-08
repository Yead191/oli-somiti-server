import express from "express";
import { collections, connectDB } from "../config/connectDB.js";
import { ObjectId } from "mongodb";
const router = express.Router();

// Initialize all collections
let transactionCollection;
async function initTransitionCollection() {
  try {
    await connectDB();
    transactionCollection = collections.transactions;
  } catch (error) {
    console.error("Error initializing transitions collection:", error);
  }
}
initTransitionCollection();

// add transaction
router.post("/", async (req, res) => {
  const transaction = req.body;
  //   console.log(transition);
  const result = await transactionCollection.insertOne(transaction);
  res.send(result);
});

// get transaction
router.get("/", async (req, res) => {
  const search = req.query.search;
  const type = req.query.type;
  const query = {};
  if (search) {
    query.$or = [{ memberName: { $regex: search, $options: "i" } }];
  }
  if (type) {
    query.type = type;
  }
  const result = await transactionCollection
    .find(query)
    .sort({ _id: -1 })
    .toArray();
  res.send(result);
});

// delete transaction
router.delete("/delete/:id", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const result = await transactionCollection.deleteOne(filter);
  res.send(result);
});

export default router;
