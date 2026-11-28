import "dotenv/config";
import app from "./app.js";
import connectDatabase from "./config/database.js";
import mailer from "./config/mailer.js";

const PORT = process.env.PORT || 3000;

connectDatabase()
  .then(() => {
    mailer
      .verify()
      .catch((error) => {
        console.error("Gmail SMTP check failed:", {
          code: error.code,
          responseCode: error.responseCode,
          command: error.command,
        });
      });

    app.listen(PORT);
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
  });
