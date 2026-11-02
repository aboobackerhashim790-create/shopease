import nodemailer from "nodemailer";

const emailUser = process.env.EMAIL_USER?.trim();

const emailAppPassword = process.env.EMAIL_APP_PASSWORD?.replace(/\s+/g, "");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: emailUser,
    pass: emailAppPassword,
  },
});

export default transporter;
