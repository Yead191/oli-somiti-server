import express from "express";
import { collections, connectDB } from "../config/connectDB.js";
import admin from "firebase-admin";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";

dotenv.config();
const router = express.Router();
const saltRounds = 10;

// Initialize Firebase Admin
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
};

// Initialize MongoDB usersCollection
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

let usersCollection;
async function initCollection() {
  try {
    const collections = await connectDB();
    if (!collections?.users) {
      throw new Error("Users collection not initialized.");
    }
    usersCollection = collections.users;
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
let transactionsCollection;
async function initTransactionCollection() {
  try {
    await connectDB();
    transactionsCollection = collections.transactions;
  } catch (error) {
    console.error("Error initializing transactions collection:", error);
  }
}
initTransactionCollection();

// Hashing password
const hashPassword = async (password) => {
  return await bcrypt.hash(password, saltRounds);
};

// Assign-User
router.post("/assign-user", async (req, res) => {
  try {
    const user = req.body;
    const password = user?.password;

    // Check if user email already exists in MongoDB
    const query = { email: user.email };
    const isExist = await usersCollection.findOne(query);
    if (isExist) {
      return res.status(400).send({
        message: "A user with this email already exists.",
        user: isExist,
      });
    }

    let hashedPassword = null;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    // Post user in Firebase Authentication
    let firebaseResult;
    try {
      firebaseResult = await admin.auth().createUser({
        email: user.email,
        password: password,
        displayName: user.name,
        photoURL: user.photo,
      });
    } catch (error) {
      return res
        .status(500)
        .send({ message: `Firebase Error: ${error.message}` });
    }

    // Prepare user info for MongoDB
    const userInfo = {
      role: user?.role,
      email: user?.email,
      name: user?.name,
      password: hashedPassword,
      photo: user?.photo,
      phoneNumber: user?.phoneNumber,
      uid: firebaseResult?.uid,
      createdAt: new Date(firebaseResult?.metadata?.creationTime).toISOString(),
      lastLoginAt: firebaseResult?.metadata?.lastSignInTime
        ? new Date(firebaseResult?.metadata?.lastSignInTime).toISOString()
        : null,
      createdBy: "assigned",
      isActive: true,
    };

    // Post user in MongoDB
    const mongoResult = await usersCollection.insertOne(userInfo);

    res.send({
      firebase: firebaseResult,
      firestore: { insertedId: firebaseResult.uid },
      message: "User Created Successfully",
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Post new user in db --->
router.post("/", async (req, res) => {
  const user = req.body;
  const password = user?.password;
  // console.log(user);

  // check if user is already exists--->
  const query = { email: user.email };
  const isExist = await usersCollection.findOne(query);
  if (isExist) {
    return res.send(isExist);
  }
  // if new user save data in db --->
  const result = await usersCollection.insertOne({
    role: "user",
    ...user,
  });
  res.send({
    data: result,
    message: "User Posted In DB Successfully",
  });
}); // Api endpoint -> /users

// delete user

router.delete("/delete-user/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).send({
        message: "Invalid or missing email address.",
      });
    }

    // Get User from MongoDB
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).send({
        message: "User not found in database.",
      });
    }

    // Get User UID
    const uid = user.uid;
    if (!uid) {
      return res.status(400).send({
        message: "User UID not found in database.",
      });
    }

    // Delete User from Firebase Authentication
    await admin.auth().deleteUser(uid);

    // Delete User from MongoDB
    const result = await usersCollection.deleteOne({ email });

    // Check if deletion was successful
    if (result.deletedCount === 0) {
      return res.status(500).send({
        message: "Failed to delete user from MongoDB.",
      });
    }

    // Log success for debugging
    console.log(`User deleted: ${email}, UID: ${uid}`);

    // Return consistent response structure
    res.status(200).send({
      firestore: {
        deletedId: uid,
      },
      message: "User Deleted Successfully from Firebase & MongoDB",
    });
  } catch (error) {
    // Log error for debugging
    console.error(`Error deleting user ${req.params.email}:`, error);

    // Return error with consistent structure
    res.status(500).send({
      message: error.message || "Failed to delete user. Please try again.",
    });
  }
});

//  get user data
router.get("/", async (req, res) => {
  let query = {};
  const role = req.query.role;
  const sort = req.query.sort;
  const search = req.query.search;
  const contributionFilter = req.query.filter;
  const active = req.query.active;

  if (active) {
    query.isActive = true;
  }
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
    ];
  }

  let sortOption = { createdAt: -1 };

  if (sort) {
    const [field, order] = sort.split("-");
    sortOption = {
      [field]: order === "asc" ? 1 : -1,
    };
  }

  try {
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "transactions",
          localField: "email",
          foreignField: "memberEmail",
          as: "transactions",
        },
      },
      {
        $addFields: {
          totalContributions: {
            $subtract: [
              {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$transactions",
                        as: "t",
                        cond: { $eq: ["$$t.type", "Deposit"] },
                      },
                    },
                    as: "d",
                    in: "$$d.amount",
                  },
                },
              },
              {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$transactions",
                        as: "t",
                        cond: { $eq: ["$$t.type", "Withdraw"] },
                      },
                    },
                    as: "w",
                    in: "$$w.amount",
                  },
                },
              },
            ],
          },
        },
      },
    ];

    // 🔍 Filter based on totalContributions if filter is provided
    if (contributionFilter) {
      let min = 0;
      let max = Infinity;

      if (contributionFilter.includes("-")) {
        const [minStr, maxStr] = contributionFilter.split("-");
        min = parseInt(minStr);
        max = parseInt(maxStr);
      } else if (contributionFilter.endsWith("+")) {
        min = parseInt(contributionFilter.replace("+", ""));
      }

      pipeline.push({
        $match: {
          totalContributions: { $gte: min, $lte: max },
        },
      });
    }

    pipeline.push(
      {
        $project: {
          _id: 1,
          name: 1,
          photo: 1,
          email: 1,
          role: 1,
          isActive: 1,
          phoneNumber: 1,
          createdAt: 1,
          totalContributions: 1,
        },
      },
      { $sort: sortOption }
    );

    const usersWithContributions = await usersCollection
      .aggregate(pipeline)
      .toArray();

    res.send(usersWithContributions);
  } catch (error) {
    console.error("Aggregation error:", error);
    res.status(500).send({ message: "Server error while fetching users." });
  }
});

// get single user data
router.get("/profile/:id?", async (req, res) => {
  try {
    const id = req.params.id;
    const email = req.query.email;
    // Validate ObjectId
    // Validate ObjectId only if `id` is present
    const isValidId = id && ObjectId.isValid(id);

    if (!isValidId && !email) {
      return res.status(400).send({
        message: "Invalid or missing user ID and email.",
      });
    }

    // Create filter for user
    const userFilter = {
      $or: [
        isValidId ? { _id: new ObjectId(id) } : null,
        email ? { email: email } : null,
      ].filter(Boolean),
    };

    // Fetch user from usersCollection
    const user = await usersCollection.findOne(userFilter);
    if (!user) {
      return res.status(404).send({
        message: "User not found.",
      });
    }

    // Fetch transactions from transactionCollection
    const transactionFilter = {
      $or: [
        isValidId ? { memberId: id } : null,
        email ? { memberEmail: email } : null,
      ].filter(Boolean),
    };
    const transactions = await transactionsCollection
      .find(transactionFilter)
      .sort({ _id: -1 })
      .toArray();
    // Send response with consistent structure
    res.status(200).send({
      result: user,
      transactions: transactions,
      message: "User profile and transitions retrieved successfully.",
    });
  } catch (error) {
    // Log error for debugging
    console.error(`Error fetching profile for ID ${req.params.id}:`, error);

    // Return error with consistent structure
    res.status(500).send({
      message:
        error.message || "Failed to retrieve user profile. Please try again.",
    });
  }
});

//  PATCH /users/update-status/:id
router.patch("/update-status/:id", async (req, res) => {
  const { id } = req.params;
  let { role, isActive, name, phoneNumber, photoURL } = req.body;

  try {
    // Fetch the user from MongoDB to get the email
    const user = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!user) {
      return res.status(404).send({ error: "User not found in MongoDB" });
    }
    if (!user.email) {
      return res.status(400).send({ error: "User email not found in MongoDB" });
    }

    // Convert isActive to boolean if it's a string
    if (typeof isActive === "string") {
      isActive = isActive.toLowerCase() === "true";
    }

    // Prepare MongoDB update object
    const updateFields = {};
    if (role && role !== user.role) updateFields.role = role;
    if (typeof isActive === "boolean" && isActive !== user.isActive)
      updateFields.isActive = isActive;
    if (name && name !== user.name) updateFields.name = name;
    if (phoneNumber && phoneNumber !== user.phoneNumber)
      updateFields.phoneNumber = phoneNumber;
    if (photoURL) updateFields.photo = photoURL;

    // If no fields to update, return early
    if (Object.keys(updateFields).length === 0) {
      return res.send({ modifiedCount: 0, message: "No changes to update" });
    }

    // Update MongoDB
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    // Update Firebase Authentication
    if (name || photoURL) {
      try {
        const firebaseUser = await admin.auth().getUserByEmail(user.email);
        const firebaseUpdate = {};
        if (name && name !== user.name) firebaseUpdate.displayName = name;
        if (photoURL) firebaseUpdate.photoURL = photoURL;

        if (Object.keys(firebaseUpdate).length > 0) {
          await admin.auth().updateUser(firebaseUser.uid, firebaseUpdate);
        }
      } catch (firebaseError) {
        console.error("Firebase update error:", firebaseError);
        return res.status(500).send({
          error: `Failed to update Firebase user: ${firebaseError.message}`,
        });
      }
    }

    if (result.modifiedCount > 0) {
      res.send(result);
    } else {
      console.log("No changes applied in MongoDB");
      res.send({ modifiedCount: 0, message: "No changes applied" });
    }
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send({ error: "Failed to update user" });
  }
});
// update profile
router.patch("/update-profile", async (req, res) => {
  const email = req.query.email;
  const filter = { email: email };
  const updateUser = req.body;
  // console.log(email);
  // console.log(updateUser);
  const updatedDoc = {
    $set: {
      name: updateUser.name,
      phoneNumber: updateUser.phoneNumber,
      photo: updateUser.photo,
    },
  };
  try {
    const result = await usersCollection.updateOne(filter, updatedDoc);
    res.send(result);
  } catch (err) {
    console.log(err.message, "error on updating profile");
  }
});

// Update user lastLoginAt --->
router.patch("/last-login-at/:email", async (req, res) => {
  const email = req.params.email;
  const { lastLoginAt } = req.body;
  const filter = { email };
  const updatedUserInfo = {
    $set: {
      lastLoginAt: lastLoginAt,
    },
  };
  const result = await usersCollection.updateOne(filter, updatedUserInfo);
  res.send({ data: result, message: "lastLoginAt Time updated successfully" });
}); // Api endpoint -> /users/update-profile/:email

export default router;
