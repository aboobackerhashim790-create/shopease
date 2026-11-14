import mongoose from "mongoose";
import Counter from "../models/Counter.js";

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.")
  }

  const connectionUrl = new URL(uri);

  // The local MongoDB service is configured as a single-node replica set so
  // order and inventory changes can run inside transactions.
  if (
    ["localhost", "127.0.0.1"].includes(connectionUrl.hostname) &&
    connectionUrl.port === "27017" &&
    !connectionUrl.searchParams.has("replicaSet")
  ) {
    connectionUrl.searchParams.set("replicaSet", "rs0");
  }

  await mongoose.connect(connectionUrl.toString());
  await Counter.updateOne(
    { _id: "orderNumber" },
    { $setOnInsert: { sequence: 999 } },
    { upsert: true },
  );
  console.log("Connected to MongoDB.");
}

export default connectDatabase;
