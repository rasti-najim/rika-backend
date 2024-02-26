import express from "express";
import bcrypt from "bcrypt";
import jwt, { Secret } from "jsonwebtoken";
import Joi from "joi";
import _ from "lodash";
import owasp from "owasp-password-strength-test";
import zxcvbn from "zxcvbn";
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

import { pool } from "../db";

const router = express.Router();

const schema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().pattern(new RegExp("^[a-zA-Z0-9]{3,30}$")).required(),
});

type RefreshToken = {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
};

// Registration route
router.post("/register", async (req, res) => {
  // Create a new user and hash the password
  const { username, password } = req.body;
  const { error } = schema.validate({ username, password });
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  // Check password strength
  //   const passwordTest = owasp.test(password);
  //   if (passwordTest.errors.length) {
  //     return res.status(400).send({ errors: passwordTest.errors });
  //   }

  // Check password strength
  const strength = zxcvbn(password);
  if (strength.score < 3) {
    return res.status(400).send({
      message: "Password is too weak.",
      suggestions: strength.feedback.suggestions,
    });
  }

  try {
    const userExists = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (userExists.rows.length > 0) {
      return res.status(400).send("Username already taken");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    console.log(hashedPassword);
    const newUser = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
      [username, hashedPassword]
    );
    console.log(newUser);
    const accessToken = jwt.sign(
      { id: newUser.rows[0].id },
      process.env.JWT_TOKEN as Secret,
      {
        expiresIn: "1h",
      }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: newUser.rows[0].id },
      process.env.REFRESH_TOKEN as Secret
    );

    // const expirationDate = getTokenExpirationDate(refreshToken);
    const hashedToken = await bcrypt.hash(refreshToken, 10);

    // Store the refresh token in your database
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)",
      [newUser.rows[0].id, hashedToken]
    );

    // Send both tokens to the client
    res.status(201).send({
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: _.omit(newUser.rows[0], ["password"]),
    });

    // res.header("auth-token", token).send(_.omit(newUser.rows[0], ["password"]));
    // res.status(201).send({ userId: result.rows[0].id });
  } catch (error) {
    res.status(400).send(error);
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Check for existing valid refresh token
      const existingToken = await pool.query(
        "SELECT * FROM refresh_tokens WHERE user_id = $1",
        [user.id]
      );
      if (existingToken.rows.length > 0) {
        return res.status(400).send("User already logged in");
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (validPassword) {
        const accessToken = jwt.sign(
          { id: user.id },
          process.env.JWT_TOKEN as Secret,
          {
            expiresIn: "1h",
          }
        );

        // Generate refresh token
        const refreshToken = jwt.sign(
          { id: user.id },
          process.env.REFRESH_TOKEN as Secret
        );

        // const expirationDate = getTokenExpirationDate(refreshToken);
        const hashedToken = await bcrypt.hash(refreshToken, 10);

        // Store the refresh token in your database
        await pool.query(
          "INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)",
          [user.id, hashedToken]
        );

        res.send({
          accessToken: accessToken,
          refreshToken: refreshToken,
          user: _.omit(user, ["password"]),
        });
      } else {
        res.status(401).send("Invalid username or password");
      }
    } else {
      res.status(401).send("Invalid username or password");
    }
  } catch (error) {
    console.error(error); // Log the error
    res.status(500).send("An error occurred while processing your request");
  }
});

router.post("/token", async (req, res) => {
  const refreshToken: string = req.body.token;
  if (!refreshToken) return res.sendStatus(401);

  try {
    // Query the database for the refresh token
    const tokens = await pool.query("SELECT * FROM refresh_tokens");
    const tokenRecord = tokens.rows.find((row: RefreshToken) =>
      bcrypt.compareSync(refreshToken, row.token)
    );

    if (!tokenRecord) return res.sendStatus(403); // Invalid token

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN as Secret,
      (err: jwt.VerifyErrors | null, user: any) => {
        if (err) return res.sendStatus(403); // Invalid token

        // Create a new access token
        const accessToken = jwt.sign(
          { id: user.id },
          process.env.JWT_TOKEN as Secret,
          {
            expiresIn: "1h",
          }
        );
        res.json({ accessToken: accessToken });
      }
    );
  } catch (error) {
    console.error("Database or server error:", error);
    res.status(500).send("Server error");
  }
});

router.delete("/logout", async (req, res) => {
  const refreshToken = req.body.token;

  if (!refreshToken) {
    return res.status(400).send("No token provided");
  }

  try {
    const tokens = await pool.query("SELECT * FROM refresh_tokens");
    console.log(tokens);
    const tokenIdToDelete = tokens.rows.find((row: RefreshToken) =>
      bcrypt.compareSync(refreshToken, row.token)
    ).id;
    console.log(tokenIdToDelete);

    if (tokenIdToDelete) {
      await pool.query("DELETE FROM refresh_tokens WHERE id = $1", [
        tokenIdToDelete,
      ]);
      console.log("Refresh token deleted.");
    }
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting refresh token:", error);
    res.sendStatus(500);
  }
});

export default router;
