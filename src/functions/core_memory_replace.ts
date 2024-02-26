import { encoding_for_model } from "tiktoken";
import { client, redisClient } from "../db";
import savePersona from "../utils/savePersona";
import { createSystemMessage } from "./core_memory";
import fetchPersona from "../utils/fetchPersona";
import { IncludeEnum } from "chromadb";

/**
 * Replace the contents of core memory. Searches for a string in the file and replaces it if there's a match.
 * To delete memories, use an empty string for new_content.
 *
 * @param {string} userId - User ID of the user.
 * @param {string} name - Section of the memory to be edited (persona or human).
 * @param {string} old_content - String to replace. Must be an exact match.
 * @param {string} new_content - Content to write to the memory. All unicode (including emojis) are supported.
 * @returns {Promise<string>} - A message indicating the success or failure of the operation.
 */
async function coreMemoryReplace(
  userId: string,
  name: string,
  old_content: string,
  new_content: string
): Promise<string> {
  const keyName =
    name === "persona" ? `personas_ai_${userId}` : `personas_human_${userId}`;
  const ttl = 3600; // For example, 1 hour TTL

  try {
    // Check if the list exists in Redis
    const listExists = await redisClient.exists(keyName);
    let listItems = [];

    if (!listExists) {
      // If the list doesn't exist, fetch from the database and repopulate Redis
      listItems = await fetchPersona(
        userId,
        name === "persona" ? "ai" : "human"
      ); // Replace with your database fetching logic
      // @ts-ignore
      await redisClient.rPush(keyName, ...listItems);
      await redisClient.expire(keyName, ttl); // Set TTL
    } else {
      // If the list exists, retrieve all items
      listItems = await redisClient.lRange(keyName, 0, -1);
    }

    const encoding = encoding_for_model("gpt-4");
    let updated = false;
    let newContentTokensCount = 0;

    for (let i = 0; i < listItems.length; i++) {
      if (listItems[i] === old_content) {
        // Replace the old_content with new_content
        listItems[i] = new_content;
        updated = true;
      }
      // Calculate the total token count with the new content
      newContentTokensCount += encoding.encode(listItems[i] || "").length;
    }

    if (updated && newContentTokensCount <= 2000) {
      // Replace the list with the updated content
      await redisClient.del(keyName); // Delete the old list
      // @ts-ignore
      await redisClient.rPush(keyName, ...listItems); // Push updated items
      await redisClient.expire(keyName, ttl); // Reset TTL

      const collection = await client.getCollection({
        name: `${name === "persona" ? "ai" : "human"}_personas`,
      });

      const results = await collection.get({
        where: { userId: userId },
        whereDocument: { $contains: old_content },
        include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
      });
      const documentId = results.ids[0];
      await savePersona(
        userId,
        old_content,
        name === "persona" ? "ai" : "human",
        documentId
      );
      await createSystemMessage(userId);
    } else if (!updated) {
      console.log("No match found for the specified old content.");
    }
  } catch (err) {
    console.error("Error with Redis operation:", err);
    return Promise.reject("Error updating memory");
  }

  return Promise.resolve("Memory updated successfully");
}

/**
 * Replace the contents of core memory. Searches for a string in the file and replaces it if there's a match.
 * To delete memories, use an empty string for new_content.
 *
 * @param {string} name - Section of the memory to be edited (persona or human).
 * @param {string} old_content - String to replace. Must be an exact match.
 * @param {string} new_content - Content to write to the memory. All unicode (including emojis) are supported.
 * @returns {null} - None is always returned as this function does not produce a response.
 */
// function coreMemoryReplace(name, old_content, new_content) {
//   const fileName = name === "persona" ? "persona.txt" : "human.txt";
//   const filePath = path.join(__dirname, `../personas/${fileName}`);

//   try {
//     // Read the current content of the file
//     let fileContent = fs.readFileSync(filePath, "utf8");

//     const encoding = encoding_for_model("gpt-4");

//     // Check if the old_content exists in the file
//     if (fileContent.includes(old_content)) {
//       // Replace the old_content with new_content
//       fileContent = fileContent.replace(
//         new RegExp(old_content, "g"),
//         new_content
//       );

//       numNewContentTokens = encoding.encode(fileContent).length;

//       if (numNewContentTokens <= 2000) {
//         // Write the updated content back to the file
//         fs.writeFileSync(filePath, fileContent);
//       }
//     } else {
//       console.log("No match found for the specified old content.");
//     }
//   } catch (err) {
//     console.error("Error occurred while replacing content:", err);
//   }

//   return null;
// }

export default coreMemoryReplace;
