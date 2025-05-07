import express from "express";
import { collections, connectDB } from "../config/connectDB.js";
const router = express.Router();

// Initialize all collections
let transitionCollection;
async function initTransitionCollection() {
  try {
    await connectDB();
    transitionCollection = collections.transitions;
  } catch (error) {
    console.error("Error initializing transitions collection:", error);
  }
}
initTransitionCollection();

router.post("/", async (req, res) => {
  const transition = req.body;
//   console.log(transition);
  const result = await transitionCollection.insertOne(transition);
  res.send(result);
});

router.get("/", async (req, res) => {
  const result = await transitionCollection.find().toArray();
  res.send(result);
});

export default router;
