import express, { Request, Response } from "express";
import authenticate, { checkJwt } from "../middleware/authenticate";
import fetchMessagesFromDatabase from "../utils/fetchMessagesFromDatabase";
import { CustomRequest } from "../utils/types/express";
const debug = require("debug")("app:messages");

const router = express.Router();

// Example route for fetching paginated data
router.get("/", async (req: CustomRequest, res: Response) => {
  try {
    const auth = req.auth;
    debug("Auth: ", auth);
    const userId = auth?.payload.sub;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // const userId = req.user?.id ?? "";
    // @ts-ignore
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
    // @ts-ignore
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page

    const messages = await fetchMessagesFromDatabase(page, limit, userId);

    res.json({
      page,
      limit,
      data: messages,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Error fetching messages", error: error.message });
  }
});

export default router;
