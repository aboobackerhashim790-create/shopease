import SupportRequest from "../models/SupportRequest.js";

const CATEGORIES = ["Order", "Payment", "Return/Refund", "Product", "Account", "Other"];

export async function createSupportRequest(input) {
  const subject = typeof input.body?.subject === "string" ? input.body.subject.trim() : "";
  const category = input.body?.category;
  const message = typeof input.body?.message === "string" ? input.body.message.trim() : "";

  if (!subject || subject.length > 120) {
    return { status: 400, body: { message: "Subject is required and must be 120 characters or fewer." } };
  }
  if (!CATEGORIES.includes(category)) {
    return { status: 400, body: { message: "Choose a valid issue category." } };
  }
  if (!message || message.length > 3000) {
    return { status: 400, body: { message: "Describe your issue in 1 to 3,000 characters." } };
  }

  try {
    const request = await SupportRequest.create({
      userId: input.user._id,
      subject,
      category,
      message,
    });
    return { status: 201, body: { message: "Your help request was sent.", request } };
  } catch (error) {
    console.error("Create support request error:", error);
    return { status: 500, body: { message: "Could not send your help request." } };
  }
}

export async function listMySupportRequests(input) {
  try {
    const requests = await SupportRequest.find({ userId: input.user._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean();
    return { status: 200, body: { requests } };
  } catch (error) {
    console.error("List customer support requests error:", error);
    return { status: 500, body: { message: "Could not load your help requests." } };
  }
}
