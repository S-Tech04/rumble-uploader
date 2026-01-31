const { generateTokens, verifyRefreshToken, generateAccessToken, revokeRefreshToken } = require("../auth");

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123";

exports.login = async (req, res) => {
    try {
        const { password } = req.body;

        if (!password || password !== AUTH_PASSWORD) {
            return res.status(401).json({ success: false, error: "Invalid password" });
        }

        const payload = { authenticated: true };
        const { accessToken, refreshToken } = generateTokens(payload);
        
        res.json({ 
            success: true, 
            accessToken,
            refreshToken,
            expiresIn: 900
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ success: false, error: "Refresh token required" });
        }

        const result = verifyRefreshToken(refreshToken);

        if (!result.valid) {
            return res.status(403).json({ success: false, error: result.error });
        }

        const newAccessToken = generateAccessToken(result.payload);

        res.json({ 
            success: true, 
            accessToken: newAccessToken,
            expiresIn: 900
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            revokeRefreshToken(refreshToken);
        }

        res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
