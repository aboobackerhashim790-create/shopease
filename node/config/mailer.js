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
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

const transporter = getTransporter();

export function getMailSender() {
  const user = (process.env.EMAIL_USER || "").trim();
  return user ? `"ShopEase" <${user}>` : "ShopEase";
}

/**
 * Universal email sender that supports:
 * 1. Brevo HTTP REST API (port 443) when BREVO_API_KEY is present (bypasses Render's SMTP port blocks!)
 * 2. Standard Nodemailer SMTP as fallback
 */
export async function sendEmailMessage({ to, subject, text }) {
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  if (brevoApiKey) {
    const senderEmail = process.env.EMAIL_USER?.trim() || "aboobackerhashim790@gmail.com";
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "ShopEase", email: senderEmail },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Brevo API HTTP error: ${response.status}`);
    }
    return;
  }

  // Fallback to Nodemailer SMTP
  const smtpTransporter = getTransporter();
  await smtpTransporter.sendMail({
    from: getMailSender(),
    to,
    subject,
    text,
  });
}

export default transporter;
