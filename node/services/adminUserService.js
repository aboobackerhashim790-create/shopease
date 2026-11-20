import mongoose from "mongoose";
import User from "../models/User.js";
import Address from "../models/Address.js";
import Order from "../models/Order.js";
// ---------------------User Management -------------------------


async function getCustomerDetails(input) {
  try {
    if (!mongoose.isValidObjectId(input.params.userId)) {
      return {
        status: 400,
        body: {
          message: "Invalid customer ID.",
        },
        authUserId: input.authUserId,
      };
    }
    const customer = await User.findOne({
      _id: input.params.userId,
      role: "customer",
    })
      .select(
        "fullName email role isVerified isBlocked personalReferralCode profilePhotoUrl createdAt",
      )
      .lean();
    if (!customer)
      return {
        status: 404,
        body: {
          message: "Customer not found.",
        },
        authUserId: input.authUserId,
      };
    const addresses = await Address.find({
      user: customer._id,
    })
      .sort({
        isDefault: -1,
        createdAt: -1,
      })
      .lean();
    return {
      status: 200,
      body: {
        customer,
        addresses,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Get customer details error:", error);
    return {
      status: 500,
      body: {
        message: "Could not load customer details.",
      },
      authUserId: input.authUserId,
    };
  }
}



async function listUsers(input) {
  function isValidDateOnly(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value;
  }


  try {
    const blockedFilter = {
      role: "customer",
      isBlocked: true,
    };
    const blockedUsersCount = await User.countDocuments(blockedFilter);
    const { fromDate, toDate } = input.query || {};
    const page = Math.max(Number.parseInt(input.query.page, 10) || 1, 1);
    const requestedLimit = Number.parseInt(input.query.limit, 10) || 10;
    const limit = Math.min(Math.max(requestedLimit, 1), 1000);
    const searchInput = input.query?.search;
    if (searchInput !== undefined && typeof searchInput !== "string") {
      return { status: 400, body: { message: "Search must be text." } };
    }
    const search = searchInput?.trim() || "";
    const sort = input.query.sort === "oldest" ? "oldest" : "latest";
    const sortDirection = sort === "oldest" ? 1 : -1;
    const userFilter = {
      role: "customer",
    };
    if ((fromDate && !isValidDateOnly(fromDate)) || (toDate && !isValidDateOnly(toDate))) {
      return {
        status: 400,
        body: { message: "Enter valid from and to dates." },
      };
    }
    if (fromDate && toDate && fromDate > toDate) {
      return {
        status: 400,
        body: { message: "The from date cannot be after the to date." },
      };
    }

    if (fromDate || toDate) {
      userFilter.createdAt = {};

      if (fromDate) {
        userFilter.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
      }

      if (toDate) {
        // Include the entire selected "to" date.
        userFilter.createdAt.$lt = new Date(
          new Date(`${toDate}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000,
        );
      }
    }
    if (input.query.status === "blocked") {
      userFilter.isBlocked = true;
    } else if (input.query.status === "active") {
      userFilter.isBlocked = false;
    }
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      userFilter.$or = [
        {
          fullName: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          email: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    const [users, totalUsers,spentData] = await Promise.all([
      User.find(userFilter)
        .select("fullName email role isVerified isBlocked createdAt")
        .sort({
          createdAt: sortDirection,
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(userFilter),
      Order.aggregate([
        {$match:{paymentStatus:"Paid"}},
        {$group:{_id:"$userId",totalSpent:{$sum:"$totalAmount"}}}
      ])
    ]);
    const spentMap = Object.fromEntries(
  spentData.map((entry) => [String(entry._id), entry.totalSpent])
);
const usersWithSpent = users.map((user) => ({
  ...user,
  totalSpent: spentMap[String(user._id)] || 0,
}));
    return {
      status: 200,
      body: {
        users:usersWithSpent,
        count: blockedUsersCount,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
        },
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Get users error:", error);
    return {
      status: 500,
      body: {
        message: "Could not load users.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function blockUser(input) {
  try {
    const { isBlocked } = input.body || {};
    if (typeof isBlocked !== "boolean") {
      return {
        status: 400,
        body: {
          message: "isBlocked must be true or false.",
        },
        authUserId: input.authUserId,
      };
    }
    if (!mongoose.isValidObjectId(input.params.userId)) {
      return {
        status: 400,
        body: {
          message: "Invalid user ID.",
        },
        authUserId: input.authUserId,
      };
    }
    const user = await User.findOneAndUpdate(
      {
        _id: input.params.userId,
        role: "customer",
      },
      {
        $set: {
          isBlocked,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).select("fullName email role isBlocked");
    if (!user) {
      return {
        status: 404,
        body: {
          message: "Customer not found.",
        },
        authUserId: input.authUserId,
      };
    }
    return {
      status: 200,
      body: {
        message: isBlocked ? "Customer blocked." : "Customer unblocked.",
        user,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Update customer block status error:", error);
    return {
      status: 500,
      body: {
        message: "Could not update customer status.",
      },
      authUserId: input.authUserId,
    };
  }
}

export { listUsers, blockUser, getCustomerDetails };
