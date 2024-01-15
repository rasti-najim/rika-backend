const { ChromaClient } = require("chromadb");
const { Pool } = require("pg");
const { createClient } = require("redis");
require("dotenv").config();

const client = new ChromaClient();

const redisClient = createClient();
const redisSubscriber = createClient(); // For subscribing to channels

redisClient.on("error", (err) => console.log("Redis Client Error", err));
redisSubscriber.on("error", (err) =>
  console.log("Redis Subscriber Error", err)
);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

module.exports = { client, pool, redisClient, redisSubscriber };
