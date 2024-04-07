import express from "express";
import bcrypt from "bcrypt";
import jwt, { Secret } from "jsonwebtoken";
import Joi from "joi";
import _ from "lodash";
import owasp from "owasp-password-strength-test";
import zxcvbn from "zxcvbn";
import nodemailer from "nodemailer";
const debug = require("debug")("app:auth");
if (process.env.NODE_ENV === "production") {
  require("dotenv").config({ path: "/etc/app.env" });
} else {
  require("dotenv").config();
}

import { pool, prisma } from "../db";

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: "willie.shanahan@ethereal.email",
    pass: "EtC4vywkmkd6ADPHFJ",
  },
});

const schema = Joi.object({
  // username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().pattern(new RegExp("^[a-zA-Z0-9]{3,30}$")).required(),
});

type RefreshToken = {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
};

router.post("/hook", async (req, res) => {
  const { userId, email, secret } = req.body;
  debug(req.body);

  if (secret !== process.env.AUTH0_HOOK_SECRET) {
    return res.status(403).json({ message: `You must provide the secret 🤫` });
  }

  try {
    await prisma.users.create({
      data: { id: userId, email: email },
    });

    return res.status(200).json({
      message: `User with ID: ${userId} has been ${
        email ? "created" : "updated"
      } successfully!`,
      userId: userId,
      email: email,
    });
  } catch (error) {
    console.error("Failed to create or update user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Registration route
router.post("/register", async (req, res) => {
  // Create a new user and hash the password
  const { email, password } = req.body;
  const { error } = schema.validate({ email, password });
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
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (userExists.rows.length > 0) {
      return res.status(400).send("A user with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationCode = Math.floor(100000 + Math.random() * 900000); // Example 6-digit code
    const hashedCode = await bcrypt.hash(verificationCode.toString(), 10);

    debug(hashedPassword);
    debug(hashedCode);
    debug(verificationCode);

    const newUser = await pool.query(
      "INSERT INTO users (email, password, code) VALUES ($1, $2, $3) RETURNING *",
      [email, hashedPassword, hashedCode]
    );

    debug(newUser);

    // Send verification code via email
    await transporter.sendMail({
      from: "sydnie.schowalter29@ethereal.email",
      to: email,
      subject: "Verify Your Email",
      text: `Your verification code is: ${verificationCode}`,
    });

    res.status(201).send(_.omit(newUser.rows[0], ["password", "code"]));

    // const accessToken = jwt.sign(
    //   { id: newUser.rows[0].id },
    //   process.env.JWT_TOKEN as Secret,
    //   {
    //     expiresIn: "1h",
    //   }
    // );

    // // Generate refresh token
    // const refreshToken = jwt.sign(
    //   { id: newUser.rows[0].id },
    //   process.env.REFRESH_TOKEN as Secret
    // );

    // // const expirationDate = getTokenExpirationDate(refreshToken);
    // const hashedToken = await bcrypt.hash(refreshToken, 10);

    // // Store the refresh token in your database
    // await pool.query(
    //   "INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)",
    //   [newUser.rows[0].id, hashedToken]
    // );

    // // Send both tokens to the client
    // res.status(201).send({
    //   accessToken: accessToken,
    //   refreshToken: refreshToken,
    //   user: _.omit(newUser.rows[0], ["password"]),
    // });

    // res.header("auth-token", token).send(_.omit(newUser.rows[0], ["password"]));
    // res.status(201).send({ userId: result.rows[0].id });
  } catch (error) {
    res.status(400).send(error);
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Check if the user's email is verified
      if (!user.verified) {
        return res
          .status(401)
          .send("Please verify your email before logging in.");
      }

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

router.post("/verify", async (req, res) => {
  debug(req.body);
  const { email, code } = req.body;

  // Retrieve the user and hashedCode from your database using the email
  const user = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  debug(user);

  if (user.rows.length === 0) {
    return res.status(400).send("User not found.");
  }

  const isValidCode = await bcrypt.compare(code.toString(), user.rows[0].code);

  if (!isValidCode) {
    return res.status(400).send("Invalid verification code.");
  }

  await pool.query("UPDATE users SET verified = true WHERE email = $1", [
    email,
  ]);

  const accessToken = jwt.sign(
    { id: user.rows[0].id },
    process.env.JWT_TOKEN as Secret,
    {
      expiresIn: "1h",
    }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { id: user.rows[0].id },
    process.env.REFRESH_TOKEN as Secret
  );

  // const expirationDate = getTokenExpirationDate(refreshToken);
  const hashedToken = await bcrypt.hash(refreshToken, 10);

  // Store the refresh token in your database
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)",
    [user.rows[0].id, hashedToken]
  );

  // Send both tokens to the client
  res.status(201).send({
    accessToken: accessToken,
    refreshToken: refreshToken,
    user: _.omit(user.rows[0], ["password", "code"]),
  });
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
