const { ChromaClient } = require("chromadb");
const { Pool } = require("pg");
const { createClient } = require("redis");
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

const client = new ChromaClient();

const redisClient = createClient(
  process.env.NODE_ENV === "production"
    ? {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        // if your ElastiCache Redis setup uses a password
        // password: 'your-password'
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
  port: process.env.DB_PORT,
});

module.exports = { client, pool, redisClient };
