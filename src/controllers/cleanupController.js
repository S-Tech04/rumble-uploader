const fs = require("fs");
const path = require("path");

const cleanupDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return { deleted: 0, message: `Directory ${dirPath} does not exist` };
  }

  let deletedCount = 0;
  const items = fs.readdirSync(dirPath);

  items.forEach((item) => {
    if (item === ".gitkeep") return;

    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
      deletedCount++;
    } else {
      fs.unlinkSync(itemPath);
      deletedCount++;
    }
  });

  return { deleted: deletedCount };
};

exports.cleanupFolders = async (req, res) => {
  try {
    const tempPath = path.join(__dirname, "../../temp");
    const downloadedPath = path.join(__dirname, "../../downloaded");

    const tempResult = cleanupDirectory(tempPath);
    const downloadedResult = cleanupDirectory(downloadedPath);

    const totalDeleted = tempResult.deleted + downloadedResult.deleted;

    res.json({
      success: true,
      message: `Cleanup complete. Deleted ${totalDeleted} items.`,
      details: {
        temp: tempResult,
        downloaded: downloadedResult,
      },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup folders: " + error.message,
    });
  }
};
