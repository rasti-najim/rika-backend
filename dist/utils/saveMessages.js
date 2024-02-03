var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { pool } = require("./db");
// Function to process and store the data
function processAndStoreData(jsonData) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let item of jsonData) {
            if (item.message &&
                item.message.role &&
                item.message.content &&
                item.message.role !== "tool" &&
                !item.message.tool_calls &&
                item.time) {
                // Insert the data into the database
                yield insertIntoDatabase(item);
            }
        }
    });
}
// Function to insert data into the database
function insertIntoDatabase(item) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const queryText = "INSERT INTO messages(user_id, role, content, time) VALUES($1, $2, $3, $4)";
            const values = [userId, item.message.role, item.message.content, item.time];
            yield pool.query(queryText, values);
        }
        catch (err) {
            console.error("Error executing query", err.stack);
        }
    });
}
