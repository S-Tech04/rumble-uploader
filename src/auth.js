require("dotenv").config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-this";

function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const tokenFromHeader = authHeader && authHeader.split(" ")[1];
    const tokenFromQuery = req.query.token;
    const token = tokenFromHeader || tokenFromQuery;

    if (!token) {
        return res.status(401).json({ success: false, error: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: "Invalid or expired token." });
    }
}

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

module.exports = { verifyToken, generateToken };
