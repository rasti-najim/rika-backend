var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require("fs");
const path = require("path");
const { encoding_for_model } = require("tiktoken");
const { client, redisClient } = require("../db");
const savePersona = require("../utils/savePersona");
const { createSystemMessage, updatesystemMessage } = require("./core_memory");
const fetchPersona = require("../utils/fetchPersona");
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
function coreMemoryReplace(userId, name, old_content, new_content) {
    return __awaiter(this, void 0, void 0, function* () {
        const keyName = name === "persona" ? `personas_ai_${userId}` : `personas_human_${userId}`;
        const ttl = 3600; // For example, 1 hour TTL
        try {
            // Check if the list exists in Redis
            const listExists = yield redisClient.exists(keyName);
            let listItems = [];
            if (!listExists) {
                // If the list doesn't exist, fetch from the database and repopulate Redis
                listItems = yield fetchPersona(userId, name === "persona" ? "ai" : "human"); // Replace with your database fetching logic
                yield redisClient.rPush(keyName, ...listItems);
                yield redisClient.expire(keyName, ttl); // Set TTL
            }
            else {
                // If the list exists, retrieve all items
                listItems = yield redisClient.lRange(keyName, 0, -1);
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
                newContentTokensCount += encoding.encode(listItems[i]).length;
            }
            if (updated && newContentTokensCount <= 2000) {
                // Replace the list with the updated content
                yield redisClient.del(keyName); // Delete the old list
                yield redisClient.rPush(keyName, ...listItems); // Push updated items
                yield redisClient.expire(keyName, ttl); // Reset TTL
                const collection = yield client.getCollection({
                    name: `${name === "persona" ? "ai" : "human"}_personas`,
                });
                const results = yield collection.get({
                    where: { userId: userId },
                    whereDocument: { $contains: old_content },
                    include: ["documents", "metadatas"],
                });
                const documentId = results.ids[0];
                yield savePersona(userId, old_content, name === "persona" ? "ai" : "human", documentId);
                yield createSystemMessage(userId);
            }
            else if (!updated) {
                console.log("No match found for the specified old content.");
            }
        }
        catch (err) {
            console.error("Error with Redis operation:", err);
            return "Error updating memory";
        }
        return null;
    });
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
