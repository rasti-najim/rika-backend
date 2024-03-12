import { ChromaClient } from "chromadb";
import { Pool } from "pg";
import { createClient } from "redis";
import fs from "fs";
import { Pinecone } from "@pinecone-database/pinecone";
import { RetellClient } from "retell-sdk";
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY ?? "", // Add default value for PINECONE_API_KEY
});

const client = new ChromaClient();

const redisClient = createClient(
  process.env.NODE_ENV === "production"
    ? {
        socket: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || "0"), // Convert port to number
          // if your ElastiCache Redis setup uses a password
          // password: 'your-password'
          tls: true,
        },
      }
    : {}
);
// const redisSubscriber = createClient(); // For subscribing to channels

redisClient.on("error", (err) => console.log("Redis Client Error", err));
// redisSubscriber.on("error", (err) =>
//   console.log("Redis Subscriber Error", err)
// );

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "0"), // Convert port to number
  ssl: process.env.NODE_ENV === "production" && {
    ca: fs.readFileSync("/etc/ssl/certs/global-bundle.pem").toString(),
    // rejectUnauthorized: false, // For testing purposes. For production, use proper SSL configuration.
  },
});

const retellClient = new RetellClient({
  apiKey: process.env.RETELL_API_KEY,
});

export { client, pool, redisClient, pc, retellClient };
