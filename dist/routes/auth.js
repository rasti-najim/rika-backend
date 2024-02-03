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
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const _ = require("lodash");
const owasp = require("owasp-password-strength-test");
const zxcvbn = require("zxcvbn");
if (process.env.NODE_ENV === "production") {
    require("dotenv").config({ path: "/etc/app.env" });
}
else {
    require("dotenv").config();
}
const { pool, redisClient } = require("../db");
const router = express.Router();
const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().pattern(new RegExp("^[a-zA-Z0-9]{3,30}$")).required(),
});
// Registration route
router.post("/register", (req, res) => __awaiter(this, void 0, void 0, function* () {
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
        const userExists = yield pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).send("Username already taken");
        }
        const hashedPassword = yield bcrypt.hash(password, 12);
        console.log(hashedPassword);
        const newUser = yield pool.query("INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *", [username, hashedPassword]);
        console.log(newUser);
        const accessToken = jwt.sign({ id: newUser.rows[0].id }, process.env.JWT_TOKEN, {
            expiresIn: "1h",
        });
        // Generate refresh token
        const refreshToken = jwt.sign({ id: newUser.rows[0].id }, process.env.REFRESH_TOKEN);
        // const expirationDate = getTokenExpirationDate(refreshToken);
        const hashedToken = yield bcrypt.hash(refreshToken, 10);
        // Store the refresh token in your database
        yield pool.query("INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)", [newUser.rows[0].id, hashedToken]);
        // Send both tokens to the client
        res.status(201).send({
            accessToken: accessToken,
            refreshToken: refreshToken,
            user: _.omit(newUser.rows[0], ["password"]),
        });
        // res.header("auth-token", token).send(_.omit(newUser.rows[0], ["password"]));
        // res.status(201).send({ userId: result.rows[0].id });
    }
    catch (error) {
        res.status(400).send(error);
    }
}));
// Login route
router.post("/login", (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { username, password } = req.body;
        const result = yield pool.query("SELECT * FROM users WHERE username = $1", [
            username,
        ]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            // Check for existing valid refresh token
            const existingToken = yield pool.query("SELECT * FROM refresh_tokens WHERE user_id = $1", [user.id]);
            if (existingToken.rows.length > 0) {
                return res.status(400).send("User already logged in");
            }
            const validPassword = yield bcrypt.compare(password, user.password);
            if (validPassword) {
                const accessToken = jwt.sign({ id: user.id }, process.env.JWT_TOKEN, {
                    expiresIn: "1h",
                });
                // Generate refresh token
                const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN);
                // const expirationDate = getTokenExpirationDate(refreshToken);
                const hashedToken = yield bcrypt.hash(refreshToken, 10);
                // Store the refresh token in your database
                yield pool.query("INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)", [user.id, hashedToken]);
                res.send({
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    user: _.omit(user, ["password"]),
                });
            }
            else {
                res.status(401).send("Invalid username or password");
            }
        }
        else {
            res.status(401).send("Invalid username or password");
        }
    }
    catch (error) {
        console.error(error); // Log the error
        res.status(500).send("An error occurred while processing your request");
    }
}));
router.post("/token", (req, res) => __awaiter(this, void 0, void 0, function* () {
    const refreshToken = req.body.token;
    if (!refreshToken)
        return res.sendStatus(401);
    try {
        // Query the database for the refresh token
        const tokens = yield pool.query("SELECT * FROM refresh_tokens");
        const tokenRecord = tokens.rows.find((row) => bcrypt.compareSync(refreshToken, row.token));
        if (!tokenRecord)
            return res.sendStatus(403); // Token not found or invalid
        // Verify the refresh token
        jwt.verify(refreshToken, process.env.REFRESH_TOKEN, (err, user) => {
            if (err)
                return res.sendStatus(403); // Invalid token
            // Create a new access token
            const accessToken = jwt.sign({ id: user.id }, process.env.JWT_TOKEN, {
                expiresIn: "1h",
            });
            res.json({ accessToken: accessToken });
        });
    }
    catch (error) {
        console.error("Database or server error:", error);
        res.status(500).send("Server error");
    }
}));
router.delete("/logout", (req, res) => __awaiter(this, void 0, void 0, function* () {
    const refreshToken = req.body.token;
    if (!refreshToken) {
        return res.status(400).send("No token provided");
    }
    try {
        const tokens = yield pool.query("SELECT * FROM refresh_tokens");
        console.log(tokens);
        const tokenIdToDelete = tokens.rows.find((row) => bcrypt.compareSync(refreshToken, row.token)).id;
        console.log(tokenIdToDelete);
        if (tokenIdToDelete) {
            yield pool.query("DELETE FROM refresh_tokens WHERE id = $1", [
                tokenIdToDelete,
            ]);
            console.log("Refresh token deleted.");
        }
        res.sendStatus(204);
    }
    catch (error) {
        console.error("Error deleting refresh token:", error);
        res.sendStatus(500);
    }
}));
module.exports = router;
