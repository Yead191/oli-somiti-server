import express from "express";
import userRoutes from "./users.js";
import transitions from "./transitions.js";
const router = express.Router();

// Root Api route
router.get("/", (req, res) => {
  res.send("Somiti Server Is Running");
});

router.use("/users", userRoutes); // Users Api routes
router.use("/transitions", transitions); // transitions Api routes

export default router;
