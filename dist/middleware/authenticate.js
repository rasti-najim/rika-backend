const jwt = require("jsonwebtoken");
if (process.env.NODE_ENV === "production") {
    require("dotenv").config({ path: "/etc/app.env" });
}
else {
    require("dotenv").config();
}
const authenticate = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
    if (token == null) {
        return res.status(401).send("No token provided"); // Or any appropriate message
    }
    jwt.verify(token, process.env.JWT_TOKEN, (err, user) => {
        if (err) {
            return res.status(403).send("Token is not valid or has expired"); // Or any appropriate message
        }
        console.log(user);
        req.user = user;
        next();
    });
};
module.exports = authenticate;
