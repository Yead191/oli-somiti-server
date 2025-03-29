import express from "express";
import { connectDB } from "../config/connectDB.js";


const router = express.Router()


// initialize userCollection
let userCollection
async function initCollection() {
    const collections = await connectDB()
    userCollection = collections.users
}

await initCollection()

// post new user into db
// Post new user in db --->
router.post("/", async (req, res) => {
    const user = req.body;
    const password = user?.password;
    // console.log(user);

    // check if user is already exists--->
    const query = { email: user.email };
    const isExist = await userCollection.findOne(query);
    if (isExist) {
        return res.send(isExist);
    }
    // if new user save data in db --->
    const result = await userCollection.insertOne({
        role: "user",
        ...user,
    });
    res.send({
        data: result,
        message: "User Posted In DB Successfully",
    });
}); // Api endpoint -> /users





export default router