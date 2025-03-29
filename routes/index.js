import express from "express";
import userRoutes from './users.js'


const router = express.Router()

// Root Api route
router.get("/", (req, res) => {
    res.send("Somiti Server Is Running");
});

router.use("/users", userRoutes); // Users Api routes



export default router;
