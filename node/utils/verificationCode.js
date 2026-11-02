import { createHmac } from "crypto";

function hashVerificationCode(code) {
  return createHmac("sha256", process.env.OTP_SECRET)
    .update(code)
    .digest("hex");
}

export { hashVerificationCode };
