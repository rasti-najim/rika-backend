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
function fetchMessagesFromDatabase(page, limit, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Calculate the starting point
        const startIndex = (page - 1) * limit;
        const query = {
            text: "SELECT * FROM messages WHERE user_id = $1 ORDER BY time DESC LIMIT $2 OFFSET $3",
            values: [userId, limit, startIndex],
        };
        try {
            const res = yield pool.query(query);
            return res.rows;
        }
        catch (err) {
            console.error(err.stack);
            throw err;
        }
    });
}
module.exports = fetchMessagesFromDatabase;
