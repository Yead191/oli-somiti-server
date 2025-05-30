import express from "express";
import userRoutes from "./users.js";
import transactions from "./transactions.js";
import statistics from "./statistics.js";
import leaderboard from "./leaderboard.js";

const router = express.Router();

// Root Api route
router.get("/", (req, res) => {
  res.send("Somiti Server Is Running");
});

router.use("/users", userRoutes); // Users Api routes
router.use("/transactions", transactions); // transitions Api routes
router.use("/statistics", statistics); // statistics Api routes
router.use("/leaderboard", leaderboard); // leaderboard Api routes

export default router;
