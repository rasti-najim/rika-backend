const express = require("express");
const authenticate = require("../middleware/authenticate");
const fetchMessagesFromDatabase = require("../utils/fetchMessagesFromDatabase");

const router = express.Router();

// Example route for fetching paginated data
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page

    const messages = await fetchMessagesFromDatabase(page, limit, userId);

    res.json({
      page,
      limit,
      data: messages,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching messages", error: error.message });
  }
});

module.exports = router;
