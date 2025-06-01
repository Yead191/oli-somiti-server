import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import routes from "./routes/index.js";
import { connectDB } from "./config/connectDB.js";
import logger from "./middleware/logger.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    "http://localhost:4173",
    "https://shopno-somiti.vercel.app"
  ],
  credentials: true,
  optionalSuccessStatus: 200,
};

// middlewares
app.use(express.json());
app.use(logger);
app.use(cors(corsOptions));

// MongoDB Connection
connectDB().catch(console.error);

// Mount Router
app.use("/", routes);

// Start the server
app.listen(port, () => {
  console.log(`Somiti Server is running at port: ${port}`);
});
