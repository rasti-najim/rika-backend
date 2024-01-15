const fs = require("fs");
const path = require("path");
const { encoding_for_model } = require("tiktoken");
const { client, redisClient } = require("../db");
const savePersona = require("../utils/savePersona");

/**
 * Replace the contents of core memory. Searches for a string in the file and replaces it if there's a match.
 * To delete memories, use an empty string for new_content.
 *
 * @param {string} userId - User ID of the user.
 * @param {string} name - Section of the memory to be edited (persona or human).
 * @param {string} old_content - String to replace. Must be an exact match.
 * @param {string} new_content - Content to write to the memory. All unicode (including emojis) are supported.
 * @returns {null} - None is always returned as this function does not produce a response.
 */
async function coreMemoryReplace(userId, name, old_content, new_content) {
  const keyName =
    name === "persona" ? `personas_ai_${userId}` : `personas_human_${userId}`;

  try {
    // Retrieve all items in the list
    const listItems = await redisClient.lRange(keyName, 0, -1);

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
      newContentTokensCount += encoding.encode(listItems[i]).length;
    }

    if (updated && newContentTokensCount <= 2000) {
      // Replace the list with the updated content
      await redisClient.del(keyName); // Delete the old list
      for (const item of listItems) {
        await client.rPush(keyName, item); // Push updated items
      }
      const collection = await client.getCollection({
        name: `${name === "persona" ? "ai" : "human"}_personas`,
      });

      const results = await collection.get({
        where: { userId: userId },
        whereDocument: { $contains: old_content },
        include: ["documents", "metadatas"],
      });
      const documentId = results.ids[0];
      await savePersona(
        userId,
        old_content,
        name === "persona" ? "ai" : "human",
        documentId
      );
      redisClient.publish("systemMessageUpdate", userId);
    } else if (!updated) {
      console.log("No match found for the specified old content.");
    }
  } catch (err) {
    console.error("Error with Redis operation:", err);
    return "Error updating memory";
  }

  return null;
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

module.exports = coreMemoryReplace;
