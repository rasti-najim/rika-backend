const { ChromaClient } = require("chromadb");
const { Pool } = require("pg");
const { createClient } = require("redis");
const fs = require("fs");
if (process.env.NODE_ENV === "production") {
    require("dotenv").config({ path: "/etc/app.env" });
}
else {
    require("dotenv").config();
}
const client = new ChromaClient();
const redisClient = createClient(process.env.NODE_ENV === "production"
    ? {
        socket: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            // if your ElastiCache Redis setup uses a password
            // password: 'your-password'
            tls: true,
        },
    }
    : {});
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
    ssl: process.env.NODE_ENV === "production" && {
        ca: fs.readFileSync("/etc/ssl/certs/global-bundle.pem").toString(),
        // rejectUnauthorized: false, // For testing purposes. For production, use proper SSL configuration.
    },
});
module.exports = { client, pool, redisClient };
