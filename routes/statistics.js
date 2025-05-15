import express from "express";
import { collections, connectDB } from "../config/connectDB.js";
const router = express.Router();

let userCollection;
async function initCollection() {
  try {
    const collections = await connectDB();
    if (!collections?.users) {
      throw new Error("Users collection not initialized.");
    }
    userCollection = collections.users;
  } catch (error) {
    console.error("Failed to initialize users collection:", error.message);
    throw error;
  }
}

initCollection().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
await initCollection();

// Initialize transitionCollection
let transactionCollection;
async function initTransactionCollection() {
  try {
    await connectDB();
    transactionCollection = collections.transactions;
  } catch (error) {
    console.error("Error initializing transactions collection:", error);
  }
}
initTransactionCollection();

router.get("/", async (req, res) => {
  try {
    // Aggregate transaction data
    const [transactionSummary] = await transactionCollection
      .aggregate([
        {
          $group: {
            _id: null,
            totalDeposits: {
              $sum: { $cond: [{ $eq: ["$type", "Deposit"] }, "$amount", 0] },
            },
            totalWithdrawals: {
              $sum: {
                $cond: [{ $in: ["$type", ["Withdraw"]] }, "$amount", 0],
              },
            },
            totalPenalties: {
              $sum: { $cond: [{ $eq: ["$type", "Penalty"] }, "$amount", 0] },
            },
            memberIds: { $addToSet: "$memberId" },
          },
        },
        {
          $project: {
            totalDeposits: 1,
            totalWithdrawals: 1,
            totalPenalties: 1,
            totalMembers: { $size: "$memberIds" },
            currentBalance: {
              $add: [
                { $subtract: ["$totalDeposits", "$totalWithdrawals"] },
                "$totalPenalties",
              ],
            },
          },
        },
      ])
      .toArray();

    // Count admins and members from userCollection
    const totalTransactions = await transactionCollection.countDocuments();
    // console.log(totalTransactions);
    const totalDepositCount = await transactionCollection.countDocuments({
      type: "Deposit",
    });
    const totalWithdrawalCount = await transactionCollection.countDocuments({
      type: "Withdraw",
    });
    const totalPenaltyCount = await transactionCollection.countDocuments({
      type: "Penalty",
    });
    const adminCount = await userCollection.countDocuments({ role: "admin" });
    const memberCountFromUsers = await userCollection.countDocuments({
      role: "member",
    });

    // Use transaction-based member count if available, else fall back to userCollection
    const totalMembers =
      transactionSummary?.totalMembers || memberCountFromUsers || 0;

    // Prepare response
    const result = {
      totalDeposits: transactionSummary?.totalDeposits || 0,
      totalWithdrawals: transactionSummary?.totalWithdrawals || 0,
      totalPenalties: transactionSummary?.totalPenalties || 0,
      currentBalance: transactionSummary?.currentBalance || 0,
      totalMembers,
      totalAdmins: adminCount || 0,
      totalTransactions: totalTransactions || 0,
      totalDepositCount: totalDepositCount || 0,
      totalWithdrawalCount: totalWithdrawalCount || 0,
      totalPenaltyCount: totalPenaltyCount || 0,
    };

    res.send(result);
  } catch (error) {
    console.error("Error generating statistics overview:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// Admin report route
router.get("/admin-report", async (req, res) => {
  try {
    // Aggregate transaction data by admin, including image from userCollection
    const adminReport = await transactionCollection
      .aggregate([
        {
          $lookup: {
            from: "users",
            let: { approvedByEmail: "$approvedByEmail" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$email", "$$approvedByEmail"] },
                  //   role: "admin",
                },
              },
              {
                $project: {
                  photo: 1,
                },
              },
            ],
            as: "adminData",
          },
        },
        {
          $unwind: {
            path: "$adminData",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: {
              name: "$approvedBy",
              email: "$approvedByEmail",
              photo: "$adminData.photo",
            },
            totalDeposits: {
              $sum: { $cond: [{ $eq: ["$type", "Deposit"] }, "$amount", 0] },
            },
            totalPenalties: {
              $sum: { $cond: [{ $eq: ["$type", "Penalty"] }, "$amount", 0] },
            },
            totalWithdrawals: {
              $sum: {
                $cond: [
                  { $in: ["$type", ["Withdraw", "Withdrawal"]] },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            adminName: "$_id.name",
            adminEmail: "$_id.email",
            adminImage: "$_id.photo",
            totalDeposits: 1,
            totalWithdrawals: 1,
            totalPenalties: 1,
          },
        },
        { $sort: { adminName: 1 } },
      ])
      .toArray();

    // Calculate overall totals
    const [overallTotals] = await transactionCollection
      .aggregate([
        {
          $group: {
            _id: null,
            totalDepositsApproved: {
              $sum: { $cond: [{ $eq: ["$type", "Deposit"] }, "$amount", 0] },
            },
            totalPenaltiesApproved: {
              $sum: { $cond: [{ $eq: ["$type", "Penalty"] }, "$amount", 0] },
            },
            totalWithdrawalsApproved: {
              $sum: {
                $cond: [
                  { $in: ["$type", ["Withdraw", "Withdrawal"]] },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalDepositsApproved: 1,
            totalWithdrawalsApproved: 1,
            totalPenaltiesApproved: 1,
          },
        },
      ])
      .toArray();

    // Prepare response
    const result = {
      totalDepositsApproved: overallTotals?.totalDepositsApproved || 0,
      totalWithdrawalsApproved: overallTotals?.totalWithdrawalsApproved || 0,
      totalPenaltiesApproved: overallTotals?.totalPenaltiesApproved || 0,
      admins: adminReport || [],
    };

    res.send(result);
  } catch (error) {
    console.error("Error generating admin report:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

export default router;
