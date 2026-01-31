const { generateToken } = require("../auth");

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "admin123";

exports.login = async (req, res) => {
    try {
        const { password } = req.body;

        if (!password || password !== AUTH_PASSWORD) {
            return res.status(401).json({ success: false, error: "Invalid password" });
        }

        const token = generateToken({ authenticated: true });
        res.json({ success: true, token });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
