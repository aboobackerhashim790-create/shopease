import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Address from "../models/Address.js";
import Wallet from "../models/Wallet.js";
import EmailChangeChallenge from "../models/EmailChangeChallenge.js";
import transporter from "../config/mailer.js";
import { randomInt, timingSafeEqual } from "crypto";
import { hashVerificationCode } from "../utils/verificationCode.js";
import {
  isCloudinaryConfigured,
  uploadProfileImage,
  deleteCloudinaryImage
} from "../config/cloudinary.js";
import { lookupIndiaPincode } from "../utils/indiaPincode.js";
import addressSchema from "../schemas/addressSchema.js";


async function updateMyProfile(input) {
  try {
    const fullName =
      typeof input.body?.fullName === "string"
        ? input.body.fullName.trim()
        : "";
    if (!fullName || fullName.length < 2 || fullName.length > 100) {
      return {
        status: 400,
        body: {
          message: "Name must be between 2 and 100 characters.",
        },
        authUserId: input.authUserId,
      };
    }
    const user = await User.findByIdAndUpdate(
      input.user._id,
      {
        $set: {
          fullName,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).select("fullName email role personalReferralCode profilePhotoUrl");
    if (!user)
      return {
        status: 404,
        body: {
          message: "Account not found.",
        },
        authUserId: input.authUserId,
      };
    return {
      status: 200,
      body: {
        message: "Profile updated.",
        user,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Update profile error:", error);
    return {
      status: 500,
      body: {
        message: "Could not update your profile.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function updateProfilePhoto(input) {
  if (!isCloudinaryConfigured()) {
    return {
      status: 503,
      body: { message: "Profile photo storage is not configured yet." },
      authUserId: input.authUserId,
    };
  }

  if (!input.file) {
    return {
      status: 400,
      body: { message: "Choose a JPG, PNG, or WebP photo up to 5 MB." },
      authUserId: input.authUserId,
    };
  }

  try {
    const currentUser = await User.findById(input.user._id)
      .select("profilePhotoPublicId");

    if (!currentUser) {
      return {
        status: 404,
        body: { message: "Account not found." },
        authUserId: input.authUserId,
      };
    }

    const oldPublicId = currentUser.profilePhotoPublicId;
    const uploaded = await uploadProfileImage(
      input.file.buffer,
      input.user._id,
    );

    let user;
    try {
      user = await User.findByIdAndUpdate(
        input.user._id,
        {
          $set: {
            profilePhotoUrl: uploaded.secure_url,
            profilePhotoPublicId: uploaded.public_id,
          },
        },
        { returnDocument: "after" },
      ).select("fullName email role personalReferralCode profilePhotoUrl");
    } catch (saveError) {
      // The database save failed, so remove the new upload and keep the old photo.
      await deleteCloudinaryImage(uploaded.public_id).catch((cleanupError) => {
        console.error("Could not clean up the new profile photo:", cleanupError);
      });
      throw saveError;
    }

    if (!user) {
      await deleteCloudinaryImage(uploaded.public_id);
      return {
        status: 404,
        body: { message: "Account not found." },
        authUserId: input.authUserId,
      };
    }

    // Delete the old asset only after the new photo is saved successfully.
    if (oldPublicId && oldPublicId !== uploaded.public_id) {
      try {
        await deleteCloudinaryImage(oldPublicId);
      } catch (deleteError) {
        // The new photo is saved; log cleanup failure without undoing the update.
        console.error("Could not delete the previous profile photo:", deleteError);
      }
    }

    return {
      status: 200,
      body: { message: "Profile photo updated.", user },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Profile photo upload error:", error);
    return {
      status: 502,
      body: { message: "Could not upload your profile photo." },
      authUserId: input.authUserId,
    };
  }
}

async function requestEmailChange(input) {
  try {
    const newEmail =
      typeof input.body?.email === "string"
        ? input.body.email.trim().toLowerCase()
        : "";
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return {
        status: 400,
        body: {
          message: "Enter a valid new email address.",
        },
        authUserId: input.authUserId,
      };
    }
    if (newEmail === input.user.email) {
      return {
        status: 400,
        body: {
          message: "That is already your email address.",
        },
        authUserId: input.authUserId,
      };
    }
    const emailAlreadyUsed = await User.exists({
      email: newEmail,
      _id: {
        $ne: input.user._id,
      },
    });
    if (emailAlreadyUsed) {
      return {
        status: 409,
        body: {
          message: "That email is already associated with an account.",
        },
        authUserId: input.authUserId,
      };
    }
    const now = new Date();

    // If a code was recently sent, don't send another one yet.
    const existingChallenge = await EmailChangeChallenge.findOne({
      user: input.user._id,
    });
    if (
      existingChallenge?.resendAvailableAt &&
      existingChallenge.resendAvailableAt > now
    ) {
      const secondsRemaining = Math.ceil(
        (existingChallenge.resendAvailableAt.getTime() - now.getTime()) / 1000,
      );
      return {
        status: 429,
        body: {
          message: `Please wait ${secondsRemaining} seconds before requesting another code.`,
        },
        authUserId: input.authUserId,
      };
    }
    const code = String(randomInt(100000, 1000000));
    await EmailChangeChallenge.findOneAndUpdate(
      {
        user: input.user._id,
      },
      {
        user: input.user._id,
        newEmail,
        codeHash: hashVerificationCode(code),
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        resendAvailableAt: new Date(now.getTime() + 60 * 1000),
        attempts: 0,
        createdAt: now,
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      },
    );
    await transporter.sendMail({
      from: "\"ShopEase\" <${process.env.EMAIL_USER}>",
      to: newEmail,
      subject: "Verify your new ShopEase email",
      text: `Your email-change verification code is ${code}. It expires in 10 minutes.`,
    });
    return {
      status: 200,
      body: {
        message: "A verification code was sent to your new email address.",
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Request email change error:", error);
    return {
      status: 500,
      body: {
        message: "Could not send the email verification code.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function verifyEmailChange(input) {
  try {
    const code = String(input.body?.code || "");
    if (!/^\d{6}$/.test(code))
      return {
        status: 400,
        body: {
          message: "Enter the 6-digit verification code.",
        },
        authUserId: input.authUserId,
      };
    const challenge = await EmailChangeChallenge.findOne({
      user: input.user._id,
      expiresAt: {
        $gt: new Date(),
      },
    });
    if (!challenge)
      return {
        status: 400,
        body: {
          message: "The code is invalid or expired. Request a new one.",
        },
        authUserId: input.authUserId,
      };
    if (challenge.attempts >= 5)
      return {
        status: 429,
        body: {
          message: "Too many incorrect codes. Request a new code.",
        },
        authUserId: input.authUserId,
      };
    const submitted = Buffer.from(hashVerificationCode(code), "hex");
    const saved = Buffer.from(challenge.codeHash, "hex");
    if (
      submitted.length !== saved.length ||
      !timingSafeEqual(submitted, saved)
    ) {
      challenge.attempts += 1;
      await challenge.save();
      return {
        status: challenge.attempts >= 5 ? 429 : 400,
        body: {
          message:
            challenge.attempts >= 5
              ? "Too many incorrect codes. Request a new code."
              : "The verification code is incorrect.",
        },
        authUserId: input.authUserId,
      };
    }
    const user = await User.findById(input.user._id);
    if (!user)
      return {
        status: 404,
        body: {
          message: "Account not found.",
        },
        authUserId: input.authUserId,
      };
    user.email = challenge.newEmail;
    user.isVerified = true;
    await user.save();
    await challenge.deleteOne();
    return {
      status: 200,
      body: {
        message: "Email address updated and verified.",
        user: {
          email: user.email,
        },
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    if (error.code === 11000)
      return {
        status: 409,
        body: {
          message: "That email is already associated with an account.",
        },
        authUserId: input.authUserId,
      };
    console.error("Verify email change error:", error);
    return {
      status: 500,
      body: {
        message: "Could not verify the new email address.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function changeMyPassword(input) {
  try {
    const { currentPassword, newPassword } = input.body || {};
    if (!currentPassword || !newPassword) {
      return {
        status: 400,
        body: {
          message: "Enter your current and new password.",
        },
        authUserId: input.authUserId,
      };
    }
    if (newPassword.length < 8) {
      return {
        status: 400,
        body: {
          message: "New password must be at least 8 characters.",
        },
        authUserId: input.authUserId,
      };
    }
    const user = await User.findById(input.user._id);
    if (!user)
      return {
        status: 404,
        body: {
          message: "Account not found.",
        },
        authUserId: input.authUserId,
      };
    if (!user.passwordHash) {
      return {
        status: 400,
        body: {
          message:
            "This account does not have a password yet. Use Forgot password to set one.",
        },
        authUserId: input.authUserId,
      };
    }
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return {
        status: 401,
        body: {
          message: "Your current password is incorrect.",
        },
        authUserId: input.authUserId,
      };
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    return {
      status: 200,
      body: {
        message: "Password changed successfully.",
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Change password error:", error);
    return {
      status: 500,
      body: {
        message: "Could not change your password.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function listMyAddresses(input) {
  try {
    const addresses = await Address.find({
      user: input.user._id,
    })
      .sort({
        isDefault: -1,
        createdAt: -1,
      })
      .lean();
    return {
      status: 200,
      body: {
        addresses,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("List addresses error:", error);
    return {
      status: 500,
      body: {
        message: "Could not load your addresses.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function getMyWallet(input) {
  try {
    const wallet = await Wallet.findOne({ userId: input.user._id })
      .select("balance transactions")
      .lean();
    const transactions = (wallet?.transactions || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
    return {
      status: 200,
      body: {
        balance: wallet?.balance || 0,
        transactions,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Load wallet error:", error);
    return {
      status: 500,
      body: { message: "Could not load your ShopEase wallet." },
      authUserId: input.authUserId,
    };
  }
}

function isIndia(country) {
  return (
    typeof country === "string" &&
    ["india", "in", "भारत"].includes(country.trim().toLowerCase())
  );
}

async function validateIndiaAddress(fields) {
  if (!isIndia(fields.country)) return null;
  if (!/^\d{6}$/.test(fields.postalCode))
    return {
      status: 400,
      code: "INVALID_PIN_CODE",
    };
  let location;
  try {
    location = await lookupIndiaPincode(fields.postalCode);
  } catch (error) {
    console.error("PIN code lookup error:", error.message);
    return {
      status: 503,
      code: "PIN_LOOKUP_UNAVAILABLE",
    };
  }
  if (!location)
    return {
      status: 404,
      code: "PIN_CODE_NOT_FOUND",
    };
  const matches = location.states.some(
    (state) => state.trim().toLowerCase() === fields.state.trim().toLowerCase(),
  );
  if (!matches)
    return {
      status: 400,
      code: "PIN_STATE_MISMATCH",
    };
  return null;
}

async function validateAddressPincode(input) {
  const postalCode =
    typeof input.params.postalCode === "string"
      ? input.params.postalCode.trim()
      : "";
  if (!/^\d{6}$/.test(postalCode))
    return {
      status: 400,
      body: {
        code: "INVALID_PIN_CODE",
      },
      authUserId: input.authUserId,
    };

  let location;
  try {
    location = await lookupIndiaPincode(postalCode);
  } catch (error) {
    console.error("PIN code lookup error:", error.message);
    return {
      status: 503,
      body: {
        code: "PIN_LOOKUP_UNAVAILABLE",
      },
      authUserId: input.authUserId,
    };
  }

  if (!location)
    return {
      status: 404,
      body: { code: "PIN_CODE_NOT_FOUND" },
      authUserId: input.authUserId,
    };

  return {
    status: 200,
    body: {
      valid: true,
      // The postal service provides a district rather than a city field.
      city: location.districts[0] || "",
      state: location.states[0] || "",
      country: "India",
    },
    authUserId: input.authUserId,
  };
}

async function createAddress(input) {
  try {
    const body = input.body || {};
    const validation = addressSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = Object.fromEntries(
        validation.error.issues
          .filter((issue) => issue.path.length > 0)
          .map((issue) => [String(issue.path[0]), issue.message]),
      );
      return {
        status: 400,
        body: {
          message: validation.error.issues[0]?.message || "Invalid address details.",
          fieldErrors,
        },
        authUserId: input.authUserId,
      };
    }
    const fields = validation.data;
    const pinError = await validateIndiaAddress(fields);
    if (pinError)
      return {
        status: pinError.status,
        body: {
          code: pinError.code,
          fieldErrors: {
            postalCode:
              pinError.code === "PIN_CODE_NOT_FOUND"
                ? "That PIN code was not found."
                : pinError.code === "PIN_STATE_MISMATCH"
                  ? "This PIN code does not match the selected state."
                  : pinError.code === "PIN_LOOKUP_UNAVAILABLE"
                    ? "PIN lookup is temporarily unavailable."
                    : "Enter a valid 6-digit Indian PIN code.",
          },
        },
        authUserId: input.authUserId,
      };
    const existingCount = await Address.countDocuments({
      user: input.user._id,
    });
    const shouldBeDefault = fields.isDefault || existingCount === 0;
    const address = await Address.create({
      ...fields,
      user: input.user._id,
      isDefault: shouldBeDefault,
    });
    if (shouldBeDefault) {
      await Address.updateMany(
        {
          user: input.user._id,
          _id: {
            $ne: address._id,
          },
        },
        {
          $set: {
            isDefault: false,
          },
        },
      );
    }
    return {
      status: 201,
      body: {
        message: "Address saved.",
        address,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    if (error.name === "ValidationError") {
      return {
        status: 400,
        body: {
          message: "Complete all required address fields.",
        },
        authUserId: input.authUserId,
      };
    }
    console.error("Create address error:", error);
    return {
      status: 500,
      body: {
        message: "Could not save this address.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function updateAddress(input) {
  try {
    const body = input.body || {};
    const validation = addressSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = Object.fromEntries(
        validation.error.issues
          .filter((issue) => issue.path.length > 0)
          .map((issue) => [String(issue.path[0]), issue.message]),
      );
      return {
        status: 400,
        body: {
          message: validation.error.issues[0]?.message || "Invalid address details.",
          fieldErrors,
        },
        authUserId: input.authUserId,
      };
    }
    const fields = validation.data;
    const pinError = await validateIndiaAddress(fields);
    if (pinError)
      return {
        status: pinError.status,
        body: {
          code: pinError.code,
          fieldErrors: {
            postalCode:
              pinError.code === "PIN_CODE_NOT_FOUND"
                ? "That PIN code was not found."
                : pinError.code === "PIN_STATE_MISMATCH"
                  ? "This PIN code does not match the selected state."
                  : pinError.code === "PIN_LOOKUP_UNAVAILABLE"
                    ? "PIN lookup is temporarily unavailable."
                    : "Enter a valid 6-digit Indian PIN code.",
          },
        },
        authUserId: input.authUserId,
      };
    if (!mongoose.isValidObjectId(input.params.addressId)) {
      return {
        status: 400,
        body: {
          message: "Invalid address ID.",
        },
        authUserId: input.authUserId,
      };
    }
    const address = await Address.findOne({
      _id: input.params.addressId,
      user: input.user._id,
    });
    if (!address)
      return {
        status: 404,
        body: {
          message: "Address not found.",
        },
        authUserId: input.authUserId,
      };
    const wasDefault = address.isDefault;
    Object.assign(address, fields);
    if (typeof body.isDefault === "boolean") address.isDefault = body.isDefault;
    await address.save();
    if (address.isDefault) {
      await Address.updateMany(
        {
          user: input.user._id,
          _id: {
            $ne: address._id,
          },
        },
        {
          $set: {
            isDefault: false,
          },
        },
      );
    } else if (wasDefault) {
      const replacement = await Address.findOne({
        user: input.user._id,
      }).sort({
        createdAt: -1,
      });
      if (replacement) {
        replacement.isDefault = true;
        await replacement.save();
      }
    }
    return {
      status: 200,
      body: {
        message: "Address updated.",
        address,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    if (error.name === "ValidationError") {
      return {
        status: 400,
        body: {
          message: "Complete all required address fields.",
        },
        authUserId: input.authUserId,
      };
    }
    console.error("Update address error:", error);
    return {
      status: 500,
      body: {
        message: "Could not update this address.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function setDefaultAddress(input) {
  try {
    if (!mongoose.isValidObjectId(input.params.addressId)) {
      return {
        status: 400,
        body: {
          message: "Invalid address ID.",
        },
        authUserId: input.authUserId,
      };
    }
    const address = await Address.findOne({
      _id: input.params.addressId,
      user: input.user._id,
    });
    if (!address)
      return {
        status: 404,
        body: {
          message: "Address not found.",
        },
        authUserId: input.authUserId,
      };
    await Address.updateMany(
      {
        user: input.user._id,
      },
      {
        $set: {
          isDefault: false,
        },
      },
    );
    address.isDefault = true;
    await address.save();
    return {
      status: 200,
      body: {
        message: "Default address updated.",
        address,
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Set default address error:", error);
    return {
      status: 500,
      body: {
        message: "Could not set the default address.",
      },
      authUserId: input.authUserId,
    };
  }
}

async function deleteAddress(input) {
  try {
    if (!mongoose.isValidObjectId(input.params.addressId)) {
      return {
        status: 400,
        body: {
          message: "Invalid address ID.",
        },
        authUserId: input.authUserId,
      };
    }
    const address = await Address.findOneAndDelete({
      _id: input.params.addressId,
      user: input.user._id,
    });
    if (!address)
      return {
        status: 404,
        body: {
          message: "Address not found.",
        },
        authUserId: input.authUserId,
      };
    if (address.isDefault) {
      const replacement = await Address.findOne({
        user: input.user._id,
      }).sort({
        createdAt: -1,
      });
      if (replacement) {
        replacement.isDefault = true;
        await replacement.save();
      }
    }
    return {
      status: 200,
      body: {
        message: "Address removed.",
      },
      authUserId: input.authUserId,
    };
  } catch (error) {
    console.error("Delete address error:", error);
    return {
      status: 500,
      body: {
        message: "Could not remove this address.",
      },
      authUserId: input.authUserId,
    };
  }
}

export {
  updateMyProfile,
  updateProfilePhoto,
  requestEmailChange,
  verifyEmailChange,
  changeMyPassword,
  listMyAddresses,
  getMyWallet,
  validateAddressPincode,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
