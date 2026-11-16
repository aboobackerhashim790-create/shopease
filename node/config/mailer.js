import nodemailer from "nodemailer";

export function getTransporter() {
  const emailUser = process.env.EMAIL_USER?.trim();
  const emailAppPassword = process.env.EMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailAppPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

const transporter = getTransporter();

export function getMailSender() {
  const user = (process.env.EMAIL_USER || "").trim();
  return user ? `"ShopEase" <${user}>` : "ShopEase";
}

export default transporter;
