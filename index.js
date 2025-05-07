import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import routes from "./routes/index.js";
import { connectDB } from "./config/connectDB.js";
import logger from "./middleware/logger.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(express.json());
app.use(logger);
app.use(cors());

// MongoDB Connection
connectDB().catch(console.error);

// Mount Router
app.use("/", routes);

// Start the server
app.listen(port, () => {
  console.log(`Somiti Server is running at port: ${port}`);
});
