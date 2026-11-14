import mongoose from "mongoose";
import SupportRequest from "../models/SupportRequest.js";
import User from "../models/User.js";

const REQUEST_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const bad = (status, message) => ({ status, body: { message } });

export async function listSupportRequests(input) {
  try {
    const query = input.query || {};
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50);
    const filter = {};
    const status = String(query.status || "all");
    if (status !== "all") {
      if (!REQUEST_STATUSES.includes(status)) return bad(400, "Choose a valid request status.");
      filter.status = status;
    }

    const search = typeof query.search === "string" ? query.search.trim() : "";
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safeSearch, "i");
      const matchingUsers = await User.find({ $or: [{ fullName: regex }, { email: regex }] }).select("_id").lean();
      filter.$or = [
        { subject: regex },
        { message: regex },
        { userId: { $in: matchingUsers.map((user) => user._id) } },
      ];
    }

    const [requests, totalRequests] = await Promise.all([
      SupportRequest.find(filter)
        .populate("userId", "fullName email")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportRequest.countDocuments(filter),
    ]);

    return {
      status: 200,
      body: {
        requests,
        pagination: { page, limit, totalRequests, totalPages: Math.ceil(totalRequests / limit) },
      },
    };
  } catch (error) {
    console.error("Admin list support requests error:", error);
    return bad(500, "Could not load help requests.");
  }
}

export async function updateSupportRequestStatus(input) {
  const { requestId } = input.params;
  const status = input.body?.status;
  if (!mongoose.isValidObjectId(requestId)) return bad(400, "Invalid help request ID.");
  if (!REQUEST_STATUSES.includes(status)) return bad(400, "Choose a valid request status.");

  try {
    const request = await SupportRequest.findByIdAndUpdate(
      requestId,
      { $set: { status } },
      { returnDocument: "after", runValidators: true },
    ).populate("userId", "fullName email");
    if (!request) return bad(404, "Help request not found.");
    return { status: 200, body: { message: "Help request status updated.", request } };
  } catch (error) {
    console.error("Admin update support request error:", error);
    return bad(500, "Could not update help request status.");
  }
}
