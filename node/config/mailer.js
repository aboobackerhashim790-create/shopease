import nodemailer from "nodemailer";

const emailUser = process.env.EMAIL_USER?.trim();

const emailAppPassword = process.env.EMAIL_APP_PASSWORD?.replace(/\s+/g, "");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailAppPassword,
  },
});

// Verify SMTP connection on startup – helpful for debugging
transporter.verify((err, success) => {
  if (err) {
    console.error('❌ SMTP verification failed:', err);
  } else {
    console.log('✅ SMTP connection verified');
  }
});

export default transporter;
