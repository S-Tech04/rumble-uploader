const express = require("express");
const router = express.Router();
const pipelineController = require("../controllers/pipelineController");
const authMiddleware = require("../middleware/auth");

router.get("/pipelines", authMiddleware, pipelineController.getAllPipelines);
router.get("/pipelines/stream", authMiddleware, pipelineController.streamAllPipelines);
router.post("/start-download", authMiddleware, pipelineController.startDownload);
router.post("/pipeline", authMiddleware, pipelineController.startPipeline);
router.post("/start-bulk-download", authMiddleware, pipelineController.startBulkDownload);

router.get("/job/:jobId", authMiddleware, pipelineController.getJobStatus);
router.get("/job/:jobId/stream", authMiddleware, pipelineController.streamJobStatus);
router.get("/status/:jobId", authMiddleware, pipelineController.getJobStatus);

router.post("/cancel/:jobId", authMiddleware, pipelineController.cancelJob);
router.post("/pause/:jobId", authMiddleware, pipelineController.pauseJob);
router.post("/resume/:jobId", authMiddleware, pipelineController.resumeJob);

router.post("/clear-failed", authMiddleware, pipelineController.clearFailedJobs);
router.post("/clear-completed", authMiddleware, pipelineController.clearCompletedJobs);
router.post("/delete-selected", authMiddleware, pipelineController.deleteSelectedJobs);
router.delete("/job/:jobId", authMiddleware, pipelineController.deleteJob);

module.exports = router;
