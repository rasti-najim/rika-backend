var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require("fs").promises;
const { pool } = require("../db");
function loadMessages(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield pool.query("SELECT * FROM messages WHERE user_id = $1 ORDER BY time LIMIT 10", [userId]);
            console.log("messages from the database", result.rows);
            // Transform each row to the new format
            const transformedMessages = result.rows.map((row) => {
                return {
                    role: row.role, // Set the appropriate value for 'role'
                    content: row.content, // Assuming 'content' is a field in your table
                };
            });
            return transformedMessages;
        }
        catch (error) {
            console.error("Error loading messages:", error);
            return []; // Return an empty array in case of an error
        }
    });
}
// async function loadMessages(filePath) {
//   try {
//     // Read the file asynchronously
//     const data = await fs.readFile(filePath, "utf8");
//     // If the file is empty, return an empty array
//     if (!data.trim()) {
//       return [];
//     }
//     // Parse the JSON data and return it as an array
//     return JSON.parse(data);
//   } catch (err) {
//     console.error("Error reading file:", err);
//     return []; // Return an empty array in case of an error
//   }
// }
module.exports = loadMessages;
