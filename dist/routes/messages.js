var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require("express");
const authenticate = require("../middleware/authenticate");
const fetchMessagesFromDatabase = require("../utils/fetchMessagesFromDatabase");
const router = express.Router();
// Example route for fetching paginated data
router.get("/", authenticate, (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
        const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
        const messages = yield fetchMessagesFromDatabase(page, limit, userId);
        res.json({
            page,
            limit,
            data: messages,
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ message: "Error fetching messages", error: error.message });
    }
}));
module.exports = router;
