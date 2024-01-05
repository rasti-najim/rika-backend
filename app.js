const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const app = express();

// const chat = require("./routes/chat");
const audio = require("./routes/audio");
const auth = require("./routes/auth");

const { chat, openai } = require("./utils/chat");
const handleShutdown = require("./utils/handle_shutdown");
const fetchPersona = require("./utils/fetchPersona");
const archivalMemoryInsert = require("./functions/archival_memory_insert");
const fetchRecallMemory = require("./utils/fetchRecallMemory");
const { redisClient } = require("./db");
const {
  appendFilesToFile,
  readFileContentsAsync,
  readFileContentsSync,
  appendListsToString,
} = require("./functions/core_memory");
const savePersona = require("./utils/savePersona");
const humanFile = path.join(__dirname, "./personas/human.txt");
const aiFile = path.join(__dirname, "./personas/ai.txt");
const chatFile = path.join(__dirname, "./system/chat.txt");
const systemFile = path.join(__dirname, "./system/system.txt");
const authenticateSocket = require("./middleware/authenticateSocket");

const port = 8080;

app.use(express.json());
app.use(cors());
// app.use("/chat", chat);
app.use("/audio", audio);
app.use("/auth", auth);

// Create an HTTP server and pass the Express app
const server = http.createServer(app);

redisClient.connect().catch((err) => {
  console.error("Error connecting to Redis:", err);
});

// Attach Socket.IO to the HTTP server
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Update this to match your client's URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use(authenticateSocket);

io.on("connection", async (socket) => {
  console.log("human connected");
  console.log(socket.user);
  const userId = socket.user.id;

  const humanPersona = await fetchPersona("human");
  const aiPersona = await fetchPersona("ai");
  console.log(humanPersona);
  console.log(aiPersona);
  await fetchRecallMemory(userId);

  var systemMessage = await appendListsToString(userId);

  // var systemMessage = "";
  // appendFilesToFile(aiFile, humanFile, chatFile, systemFile);

  // const fileContents = readFileContentsSync(systemFile);
  // // console.log(fileContents);
  // systemMessage = fileContents;

  socket.on("send_message", async (data) => {
    const { message, time } = data;
    try {
      const completion = await chat({ userId, systemMessage, message, time });

      // After processing, emit a response back to the client
      socket.emit("receive_message", completion);
    } catch (error) {
      console.error("Error:", error);
      socket.emit("error", "Internal Server Error");
    }
  });

  socket.on("disconnect", async () => {
    console.log("client disconnected");
    // await redisClient.disconnect();

    try {
      // Read the file contents
      const humanPersona = fs.readFileSync(humanFile, "utf8");
      const aiPersona = fs.readFileSync(aiFile, "utf8");
      console.log(humanPersona);
      console.log(aiPersona);
      await savePersona(humanPersona, "human", openai);
      await savePersona(aiPersona, "ai", openai);
    } catch (err) {
      console.error("Error reading file:", err);
    }
  });
});

// Handle process termination:
process.on("SIGINT", () => {
  redisClient.disconnect().then(() => {
    console.log("Redis client disconnected");
    process.exit(0);
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
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
