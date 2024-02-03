var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const ngrok = require("@ngrok/ngrok");
const debug = require("debug")("app");
const app = express();
// const chat = require("./routes/chat");
const audio = require("./routes/audio");
const auth = require("./routes/auth");
const embeddings = require("./routes/embeddings");
const messages = require("./routes/messages");
const chat = require("./utils/chat");
const handleShutdown = require("./utils/handle_shutdown");
const fetchPersona = require("./utils/fetchPersona");
const archivalMemoryInsert = require("./functions/archival_memory_insert");
const fetchRecallMemory = require("./utils/fetchRecallMemory");
const { redisClient, redisSubscriber } = require("./db");
const { appendFilesToFile, readFileContentsAsync, readFileContentsSync, createSystemMessage, } = require("./functions/core_memory");
const authenticateSocket = require("./middleware/authenticateSocket");
const PORT = process.env.PORT || 8080;
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
// app.use("/chat", chat);
app.use("/audio", audio);
app.use("/auth", auth);
app.use("/embeddings", embeddings);
app.use("/messages", messages);
// Create an HTTP server and pass the Express app
const server = http.createServer(app);
// ngrok.connect({ addr: 8080, authtoken_from_env: true }).then((listener) => {
//   console.log(`Ingress established at: ${listener.url()}`);
//   app.set("ngrokUrl", listener.url());
// });
redisClient.connect().catch((err) => {
    console.error("Error connecting to Redis:", err);
});
// redisSubscriber.on("message", async (channel, message) => {
//   console.log(`Received message from ${channel}: ${message}`);
//   // The message is expected to be userId in this context
//   const userId = message;
//   systemMessagesMap[userId] = await createSystemMessage(userId);
// });
// redisSubscriber
//   .connect()
//   .then(() => {
//     // Subscribe to the channel
//     redisSubscriber.subscribe("systemMessageUpdate", (err, count) => {
//       if (err) {
//         console.error("Failed to subscribe: %s", err.message);
//       } else {
//         console.log(
//           `Subscribed successfully! This client is currently subscribed to ${count} channels.`
//         );
//       }
//     });
//   })
//   .catch((err) => {
//     console.error("Error connecting to Redis subscriber:", err);
//   });
// Attach Socket.IO to the HTTP server
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // Update this to match your client's URL
        methods: ["GET", "POST"],
        credentials: true,
    },
});
io.use(authenticateSocket);
io.on("connection", (socket) => __awaiter(this, void 0, void 0, function* () {
    debug("human connected");
    debug(socket.user);
    const userId = socket.user.id;
    const humanPersona = yield fetchPersona(userId, "human");
    const aiPersona = yield fetchPersona(userId, "ai");
    debug(humanPersona);
    debug(aiPersona);
    // await fetchRecallMemory(userId);
    yield createSystemMessage(userId);
    // Define the heartbeat interval in milliseconds (e.g., 5000ms = 5 seconds)
    // const heartbeatInterval = 5000;
    // Function that performs the action on each heartbeat
    // function onHeartbeat() {
    //   console.log("Heartbeat action performed");
    //   // Your custom logic here
    //   // For example, check server status, perform a task, etc.
    // }
    // Set up the heartbeat interval
    // setInterval(() => {
    //   try {
    //     onHeartbeat();
    //   } catch (error) {
    //     console.error("Heartbeat action failed", error);
    //     // Optional: Implement error handling or recovery logic
    //   }
    // }, heartbeatInterval);
    // var systemMessage = "";
    // appendFilesToFile(aiFile, humanFile, chatFile, systemFile);
    // const fileContents = readFileContentsSync(systemFile);
    // // console.log(fileContents);
    // systemMessage = fileContents;
    // Handle heartbeat messages
    // socket.on("heartbeat", async () => {
    //   console.log("Heartbeat received from client");
    //   // Perform any action you need on each heartbeat
    //   // For example, log something, check server status, etc.
    //   const message = {
    //     role: "user",
    //     content:
    //       "Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed.",
    //   };
    //   let date = new Date();
    //   let time = date.toISOString().replace("T", " ").substring(0, 19);
    //   const completion = await chat({ userId, systemMessage, message, time });
    //   debug("Memory updated using heatbeat", completion);
    // });
    socket.on("send_message", (data) => __awaiter(this, void 0, void 0, function* () {
        const { message, time } = data;
        try {
            const completion = yield chat({ userId, message, time });
            // After processing, emit a response back to the client
            socket.emit("receive_message", completion);
        }
        catch (error) {
            console.error("Error:", error);
            socket.emit("error", "Internal Server Error");
        }
    }));
    socket.on("disconnect", () => __awaiter(this, void 0, void 0, function* () {
        console.log("client disconnected");
        // await redisClient.disconnect();
    }));
}));
// Handle process termination:
process.on("SIGINT", () => {
    redisClient.disconnect().then(() => {
        console.log("Redis client disconnected");
        process.exit(0);
    });
});
server.listen(PORT, () => __awaiter(this, void 0, void 0, function* () {
    console.log(`Server running on http://localhost:${PORT}`);
}));
// const server = app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`);
// });
// // Listening for interrupt signal (SIGINT, usually caused by Ctrl+C)
// process.on("SIGINT", (signal) => handleShutdown(signal, server));
// // Listening for terminate signal (SIGTERM, sent by system shutdown)
// process.on("SIGTERM", (signal) => handleShutdown(signal, server));
// // Optionally handle other events, such as uncaught exceptions
// process.on("uncaughtException", (err) => {
//   console.error("Uncaught exception:", err);
//   // Perform cleanup
//   server.close(() => {
//     process.exit(1);
//   });
// });
