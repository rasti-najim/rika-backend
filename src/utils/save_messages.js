const fs = require("fs").promises;
const { redisClient } = require("../db");
const { pool } = require("../db");

// Function to check Redis list length and move messages to PostgreSQL
async function saveMessages(userId, messages) {
  for (const messageObj of messages) {
    if (
      messageObj.message &&
      messageObj.message.role &&
      messageObj.message.content &&
      messageObj.message.role !== "tool" &&
      !messageObj.message.tool_calls &&
      messageObj.time
    ) {
      const { role, content } = messageObj.message;
      const insertQuery =
        "INSERT INTO messages (user_id, role, content, time) VALUES ($1, $2, $3, $4)";
      const values = [userId, role, content, messageObj.time];
      await pool.query(insertQuery, values);
    }
  }

  // const listLength = await redisClient.lLen(`messages_${userId}`);

  // // Save to PostgreSQL when list length reaches 20 or more
  // if (listLength >= 20) {
  //   // Get the oldest 10 messages
  //   const messages = await redisClient.lRange(`messages_${userId}`, 0, 9);

  //   // Process each message
  //   for (const messageString of messages) {
  //     const messageObj = JSON.parse(messageString);
  //     if (
  //       messageObj.message &&
  //       messageObj.message.role &&
  //       messageObj.message.content &&
  //       messageObj.message.role !== "tool" &&
  //       !messageObj.message.tool_calls &&
  //       messageObj.time
  //     ) {
  //       const { role, content } = messageObj.message;
  //       const insertQuery =
  //         "INSERT INTO messages (user_id, role, content, time) VALUES ($1, $2, $3, $4)";
  //       const values = [userId, role, content, messageObj.time];
  //       await pool.query(insertQuery, values);
  //     }
  //   }

  //   // Remove the processed messages from the Redis list
  //   for (let i = 0; i < 10; i++) {
  //     await redisClient.lPop(`messages_${userId}`);
  //   }
  // }
}

// async function saveMessages(objects, filePath) {
//   try {
//     // Read the existing file
//     let data = await fs.readFile(filePath, "utf8");

//     let messages;
//     if (data) {
//       // Parse the JSON to an array
//       messages = JSON.parse(data);

//       // Push the new objects to the array
//       messages.push(...objects);
//     } else {
//       // If the file is empty, use the new objects as the content
//       messages = objects;
//     }

//     // Convert the updated array back to a JSON string
//     data = JSON.stringify(messages, null, 2);

//     // Write the updated JSON string back to the file
//     await fs.writeFile(filePath, data, "utf8");
//   } catch (err) {
//     console.error("Error writing file:", err);
//   }
// }

module.exports = saveMessages;
