import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "./relations.js";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle({ client: pool, relations });
