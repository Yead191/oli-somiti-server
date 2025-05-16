import express from "express";
import { collections, connectDB } from "../config/connectDB.js";

const router = express.Router();

let userCollection;
let transactionCollection;

async function initCollections() {
  try {
    await connectDB();
    userCollection = collections.users;
    transactionCollection = collections.transactions;
  } catch (error) {
    console.error("Failed to initialize collections:", error.message);
    throw error;
  }
}

// Initialize collections and handle errors
initCollections().catch((error) => {
  console.error("Initialization failed:", error);
  process.exit(1);
});

router.get("/", async (req, res) => {
  try {
    const leaderboard = await userCollection
      .aggregate([
        {
          $lookup: {
            from: "transactions", 
            localField: "email",
            foreignField: "memberEmail",
            as: "transactions",
          },
        },
        {
          $unwind: {
            path: "$transactions",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: "$email",
            uid: { $first: "$_id" },
            name: { $first: "$name" },
            email: { $first: "$email" },
            photo: { $first: "$photo" },
            phoneNumber: { $first: "$phoneNumber" },
            createdAt: { $first: "$createdAt" },
            totalDeposit: {
              $sum: {
                $cond: [
                  { $eq: ["$transactions.type", "Deposit"] },
                  "$transactions.amount",
                  0,
                ],
              },
            },
            totalWithdraw: {
              $sum: {
                $cond: [
                  { $eq: ["$transactions.type", "Withdraw"] },
                  "$transactions.amount",
                  0,
                ],
              },
            },
            totalPenalties: {
              $sum: {
                $cond: [
                  { $eq: ["$transactions.type", "Penalty"] },
                  "$transactions.amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $addFields: {
            totalContribution: {
              $subtract: ["$totalDeposit", "$totalWithdraw"],
            },
          },
        },
        {
          $setWindowFields: {
            sortBy: { totalContribution: -1 },
            output: { rank: { $rank: {} } },
          },
        },
        {
          $sort: { totalContribution: -1 },
        },
        {
          $project: {
            _id: 0,
            uid: 1,
            rank: 1,
            name: 1,
            email: 1,
            photo: 1,
            phoneNumber: 1,
            joinDate: "$createdAt",
            totalDeposit: 1,
            totalWithdraw: 1,
            totalPenalties: 1,
            totalContribution: 1,
          },
        },
      ])
      .toArray();

    res.status(200).json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching leaderboard",
    });
  }
});

export default router;
