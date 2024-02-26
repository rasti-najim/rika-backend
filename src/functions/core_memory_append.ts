import fs from "fs";
import path from "path";
import { encoding_for_model } from "tiktoken";
import { redisClient } from "../db";
import fetchPersona from "../utils/fetchPersona";
import savePersona from "../utils/savePersona";
import { createSystemMessage } from "./core_memory";

/**
 * Append to the contents of core memory.
 *
 * @param {string} userId - User ID of the user.
 * @param {string} name - Section of the memory to be edited (persona or human).
 * @param {string} content - Content to write to the memory. All unicode (including emojis) are supported.
 * @returns {Promise<string>} - A promise that resolves to a string indicating the success of the operation.
 */
async function coreMemoryAppend(
  userId: string,
  name: string,
  content: string
): Promise<string> {
  const keyName =
    name === "persona" ? `personas_ai_${userId}` : `personas_human_${userId}`;
  const ttl = 3600; // For example, 1 hour TTL

  try {
    const listExists = await redisClient.exists(keyName);
    let listItems = [];

    if (!listExists) {
      listItems = await fetchPersona(
        userId,
        name === "persona" ? "ai" : "human"
      );
      // @ts-ignore
      await redisClient.rPush(keyName, ...listItems);
      await redisClient.expire(keyName, ttl); // Set TTL
    } else {
      listItems = await redisClient.lRange(keyName, 0, -1);
    }

    const existingData = listItems.join("\n");
    const encoding = encoding_for_model("gpt-4");
    const numPersonaTokens = encoding.encode(existingData).length;
    console.log(numPersonaTokens);
    const numContentTokens = encoding.encode(content).length;
    console.log(numContentTokens);

    if (numPersonaTokens + numContentTokens > 2000) {
      return Promise.resolve(
        "Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed."
      );
    }

    await savePersona(userId, content, name === "persona" ? "ai" : "human");
    await createSystemMessage(userId);
  } catch (err) {
    console.error("Error updating memory:", err);
    return Promise.reject(err);
  }

  return Promise.resolve("memory updated successfully");
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

// async function handleMemoryOverflow() {
//   let date = new Date();
//   let dateString = date.toISOString().replace("T", " ").substring(0, 19);
//   let response = await fetch("http://localhost:8080/chat", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       message: {
//         role: "user",
//         content:
//           "Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed.",
//       },
//       time: dateString,
//     }),
//   });

//   if (!response.ok) {
//     throw new Error(`HTTP error! status: ${response.status}`);
//   }
//   let data = await response.json();
//   console.log(data);

//   if (data.role === "tool") {
//     console.log("sending tool message");

//     // Introduce a delay
//     await delay(1000); // Delay for 1 second

//     let date = new Date();
//     let dateString = date.toISOString().replace("T", " ").substring(0, 19);

//     response = await fetch("http://localhost:8080/chat", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ message: data, time: dateString }),
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     data = await response.json();
//   }
// }

export default coreMemoryAppend;
