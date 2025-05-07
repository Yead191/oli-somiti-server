import express from "express";
import { collections, connectDB } from "../config/connectDB.js";
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

router.post("/", async (req, res) => {
  const transaction = req.body;
  //   console.log(transition);
  const result = await transactionCollection.insertOne(transaction);
  res.send(result);
});

router.get("/", async (req, res) => {
  const result = await transactionCollection.find().toArray();
  res.send(result);
});

export default router;
