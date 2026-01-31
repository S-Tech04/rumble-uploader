const express = require("express");
const router = express.Router();
const episodeController = require("../controllers/episodeController");
const authMiddleware = require("../middleware/auth");

router.get("/search", authMiddleware, episodeController.searchAnime);
router.get("/episodes/:animeId", authMiddleware, episodeController.getEpisodes);
router.post("/start-bulk-episodes", authMiddleware, episodeController.startBulkEpisodes);

module.exports = router;
