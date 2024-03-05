import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import ngrok from "@ngrok/ngrok";
const debug = require("debug")("app");
require("dotenv").config();
const app = express();

// const chat = require("./routes/chat");
import audio from "./routes/audio";
import auth from "./routes/auth";
import embeddings from "./routes/embeddings";
import messages from "./routes/messages";

import { chat } from "./utils/chat";
import voice from "./utils/voice";
import handleShutdown from "./utils/handle_shutdown";
import fetchPersona from "./utils/fetchPersona";
import archivalMemoryInsert from "./functions/archival_memory_insert";
import fetchRecallMemory from "./utils/fetchRecallMemory";
import { redisClient } from "./db";
import openai from "./utils/openaiClient";
import { createSystemMessage } from "./functions/core_memory";
import authenticateSocket from "./middleware/authenticateSocket";

const PORT: number | string = process.env.PORT || 8080;

interface CustomSocket extends Socket {
  user: {
    id: string;
    // Include other user properties here if necessary
  };
}

app.use(express.json({ limit: "50mb" }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("uploads"));
// app.use("/chat", chat);
app.use("/audio", audio);
app.use("/auth", auth);
app.use("/embeddings", embeddings);
app.use("/messages", messages);

// Create an HTTP server and pass the Express app
const server = http.createServer(app);

if (process.env.NODE_ENV === "development") {
  ngrok.connect({ addr: 8080, authtoken_from_env: true }).then((listener) => {
    console.log(`Ingress established at: ${listener.url()}`);
    app.set("ngrokUrl", listener.url());
  });
}

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
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:3000", // Update this to match your client's URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use(authenticateSocket);

io.on("connection", async (socket: Socket) => {
  const customSocket = socket as CustomSocket;
  debug("human connected");
  debug(customSocket.user); // Access the 'user' property directly
  const userId = customSocket.user.id;

  const humanPersona = await fetchPersona(userId, "human");
  const aiPersona = await fetchPersona(userId, "ai");
  debug(humanPersona);
  debug(aiPersona);
  // await fetchRecallMemory(userId);

  await createSystemMessage(userId);

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

  socket.on("send_message", async (data) => {
    const { message, time } = data;
    try {
      let completion = await chat(userId, message, time);

      if (completion && "role" in completion && completion.role === "tool") {
        completion = await chat(
          userId,
          completion,
          new Date().toISOString().replace("T", " ").substring(0, 19)
        );
      }

      // After processing, emit a response back to the client
      socket.emit("receive_message", completion);
    } catch (error) {
      console.error("Error:", error);
      socket.emit("error", "Internal Server Error");
    }
  });

  socket.on("send_audio", async (data) => {
    try {
      const { base64Audio, fileName } = data;
      const audioUrl = await voice(userId, base64Audio, fileName, app);
      socket.emit("recieve_audio", audioUrl);
    } catch (error) {
      console.error("Error:", error);
      socket.emit("error", "Internal Server Error");
    }
  });

  socket.on("disconnect", async () => {
    console.log("client disconnected");
    // await redisClient.disconnect();
  });
});

// Handle process termination:
process.on("SIGINT", () => {
  redisClient.disconnect().then(() => {
    console.log("Redis client disconnected");
    process.exit(0);
  });
});

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

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
