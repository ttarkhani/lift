// Imported first by every script: loads .env.local the way `next dev` would.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
