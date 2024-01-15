const fs = require("fs");
const path = require("path");
const { encoding_for_model } = require("tiktoken");
const { redisClient } = require("../db");
const savePersona = require("../utils/savePersona");

/**
 * Append to the contents of core memory.
 *
 * @param {string} userId - User ID of the user.
 * @param {string} name - Section of the memory to be edited (persona or human).
 * @param {string} content - Content to write to the memory. All unicode (including emojis) are supported.
 * @returns {null} - None is always returned as this function does not produce a response.
 */
async function coreMemoryAppend(userId, name, content) {
  const keyName =
    name === "persona" ? `personas_ai_${userId}` : `personas_human_${userId}`;

  try {
    const listItems = await redisClient.lRange(keyName, 0, -1);
    const existingData = listItems.join("\n");
    const encoding = encoding_for_model("gpt-4");
    const numPersonaTokens = encoding.encode(existingData).length;
    console.log(numPersonaTokens);
    const numContentTokens = encoding.encode(content).length;
    console.log(numContentTokens);

    if (numPersonaTokens + numContentTokens > 2000) {
      return "Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed.";
    }

    // Append new content to the list
    await redisClient.rPush(keyName, content);
    await savePersona(userId, content, name === "persona" ? "ai" : "human");
    redisClient.publish("systemMessageUpdate", userId);
  } catch (err) {
    console.error("Error updating memory:", err);
    return "Error updating memory";
  }

  return "memory updated successfully";
}

/**
 * Append to the contents of core memory.
 *
 * @param {string} name - Section of the memory to be edited (persona or human).
 * @param {string} content - Content to write to the memory. All unicode (including emojis) are supported.
 * @returns {null} - None is always returned as this function does not produce a response.
 */
// function coreMemoryAppend(name, content) {
//   const fileName = name === "persona" ? "ai.txt" : "human.txt";
//   const filePath = path.join(__dirname, `../personas/${fileName}`);

//   try {
//     const data = fs.readFileSync(filePath, "utf8");
//     const encoding = encoding_for_model("gpt-4");
//     numPersonaTokens = encoding.encode(data).length;
//     console.log(numPersonaTokens);
//     numContentTokens = encoding.encode(content).length;
//     console.log(numContentTokens);
//     if (numPersonaTokens + numContentTokens > 2000) {
//       return "Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed.";
//     }
//     fs.appendFileSync(filePath, "\n" + content);
//   } catch (err) {
//     console.error("Error appending to file:", err);
//   }

//   return "memory updated successfully";
//   // return null;
// }

async function handleMemoryOverflow() {
  let date = new Date();
  let dateString = date.toISOString().replace("T", " ").substring(0, 19);
  let response = await fetch("http://localhost:8080/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        role: "user",
        content:
          "Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed.",
      },
      time: dateString,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  let data = await response.json();
  console.log(data);

  if (data.role === "tool") {
    console.log("sending tool message");

    // Introduce a delay
    await delay(1000); // Delay for 1 second

    let date = new Date();
    let dateString = date.toISOString().replace("T", " ").substring(0, 19);

    response = await fetch("http://localhost:8080/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: data, time: dateString }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    data = await response.json();
  }
}

module.exports = coreMemoryAppend;
