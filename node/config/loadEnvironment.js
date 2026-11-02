import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(currentDirectory, "..", ".env") });
