require("dotenv").config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-this";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default-refresh-secret-change-this";

const refreshTokens = new Map();

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
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, error: "Token expired.", expired: true });
        }
        return res.status(403).json({ success: false, error: "Invalid token." });
    }
}

function generateAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

function generateRefreshToken(payload) {
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
    refreshTokens.set(refreshToken, payload);
    return refreshToken;
}

function generateTokens(payload) {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    return { accessToken, refreshToken };
}

function verifyRefreshToken(refreshToken) {
    try {
        if (!refreshTokens.has(refreshToken)) {
            return { valid: false, error: "Refresh token not found" };
        }

        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        return { valid: true, payload: decoded };
    } catch (error) {
        refreshTokens.delete(refreshToken);
        return { valid: false, error: "Invalid or expired refresh token" };
    }
}

function revokeRefreshToken(refreshToken) {
    refreshTokens.delete(refreshToken);
}

function generateToken(payload) {
    return generateAccessToken(payload);
}

module.exports = { 
    verifyToken, 
    generateToken,
    generateAccessToken,
    generateRefreshToken,
    generateTokens,
    verifyRefreshToken,
    revokeRefreshToken
};
