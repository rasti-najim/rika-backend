var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { pool } = require("../db");
function fetchRecallMemory(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const query = "SELECT * FROM Messages WHERE user_id = $1 ORDER BY time DESC LIMIT 10";
            const result = yield pool.query(query, [userId]);
            // Structure the data in JSON format
            const messages = result.rows.map((row) => ({
                message: {
                    role: row.role,
                    content: row.content,
                },
                time: row.time,
            }));
            return messages;
        }
        catch (error) {
            console.error("Error fetching messages:", error);
            throw error;
        }
    });
}
module.exports = fetchRecallMemory;
