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
  const method = req.query.method;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  const query = {};
  if (search) {
    query.$or = [{ memberName: { $regex: search, $options: "i" } }];
  }
  if (type) {
    query.type = type;
  }
  // console.log(method);
  if (method && method !== "all") {
    query.paymentMethod = method;
  }
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
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

// transactions summary
router.get("/summary", async (req, res) => {
  const { startDate, endDate } = req.query;

  // Build query for date filtering
  const query = {};
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }

  try {
    // Aggregation pipeline
    const [summary] = await transactionCollection
      .aggregate([
        // Apply date filter
        { $match: query },
        // Group for totals and member count
        {
          $group: {
            _id: null,
            totalDeposits: {
              $sum: { $cond: [{ $eq: ["$type", "Deposit"] }, "$amount", 0] },
            },
            totalWithdrawals: {
              $sum: { $cond: [{ $eq: ["$type", "Withdraw"] }, "$amount", 0] },
            },
            totalPenalties: {
              $sum: { $cond: [{ $eq: ["$type", "Penalty"] }, "$amount", 0] },
            },
            memberIds: { $addToSet: "$memberId" },
          },
        },
        // Project main metrics
        {
          $project: {
            totalDeposits: 1,
            totalWithdrawals: 1,
            totalPenalties: 1,
            balance: { $subtract: ["$totalDeposits", "$totalWithdrawals"] },
            memberCount: { $size: "$memberIds" },
          },
        },
      ])
      .toArray();

    // Deposits by category
    const depositsByCategory = await transactionCollection
      .aggregate([
        { $match: { ...query, type: "Deposit" } },
        {
          $group: {
            _id: "$paymentMethod",
            amount: { $sum: "$amount" },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id",
            amount: 1,
          },
        },
      ])
      .toArray();

    // Withdrawals by category
    const withdrawalsByCategory = await transactionCollection
      .aggregate([
        { $match: { ...query, type: "Withdraw" } },
        {
          $group: {
            _id: "$paymentMethod",
            amount: { $sum: "$amount" },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id",
            amount: 1,
          },
        },
      ])
      .toArray();

    // Deposits by payment method
    const depositsByMethod = await transactionCollection
      .aggregate([
        { $match: { ...query, type: "Deposit" } },
        {
          $group: {
            _id: "$paymentMethod",
            amount: { $sum: "$amount" },
          },
        },
        {
          $project: {
            _id: 0,
            method: "$_id",
            amount: 1,
          },
        },
      ])
      .toArray();

    // Monthly totals
    const monthlyTotals = await transactionCollection
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              $substr: ["$date", 0, 7], // Extract YYYY-MM for month
            },
            deposits: {
              $sum: { $cond: [{ $eq: ["$type", "Deposit"] }, "$amount", 0] },
            },
            withdrawals: {
              $sum: { $cond: [{ $eq: ["$type", "Withdraw"] }, "$amount", 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            month: {
              $arrayElemAt: [
                [
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ],
                { $subtract: [{ $toInt: { $substr: ["$_id", 5, 2] } }, 1] },
              ],
            },
            deposits: 1,
            withdrawals: 1,
          },
        },
        { $sort: { month: 1 } },
      ])
      .toArray();

    // Fill in missing months (January to May for 2025)
    const allMonths = ["January", "February", "March", "April", "May"];
    const monthlyTotalsFilled = allMonths.map((month) => {
      const found = monthlyTotals.find((m) => m.month === month);
      return found || { month, deposits: 0, withdrawals: 0 };
    });

    // Combine results
    const result = {
      totalDeposits: summary?.totalDeposits || 0,
      totalWithdrawals: summary?.totalWithdrawals || 0,
      totalPenalties: summary?.totalPenalties || 0,
      balance: summary?.balance || 0,
      memberCount: summary?.memberCount || 0,
      depositsByCategory,
      withdrawalsByCategory,
      depositsByMethod,
      monthlyTotals: monthlyTotalsFilled,
    };

    res.send(result);
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

export default router;
