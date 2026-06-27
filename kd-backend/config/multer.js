// config/multer.js – Multer Upload-Konfiguration

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');
const uploadsOverviewDir = path.join(uploadDir, 'overview');
const uploadsHonorDir = path.join(uploadDir, 'honor');
const uploadsActivityDir = path.join(uploadDir, 'activity');
const uploadsTop1000Dir = path.join(uploadDir, 'top1000');

[uploadDir, uploadsOverviewDir, uploadsHonorDir, uploadsActivityDir, uploadsTop1000Dir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const allowedExtensions = ['.xlsx', '.xls', '.csv'];

function createStorage(destDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
  });
}

function fileFilter(req, file, cb) {
  if (allowedExtensions.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('Only Excel and CSV files are allowed'), false);
}

const uploadOptions = { fileFilter, limits: { fileSize: 50 * 1024 * 1024 } };

const overviewUpload = multer({ storage: createStorage(uploadsOverviewDir), ...uploadOptions });
const honorUpload = multer({ storage: createStorage(uploadsHonorDir), ...uploadOptions });
const activityUpload = multer({ storage: createStorage(uploadsActivityDir), ...uploadOptions });
const top1000Upload = multer({ storage: createStorage(uploadsTop1000Dir), ...uploadOptions });

module.exports = { overviewUpload, honorUpload, activityUpload, top1000Upload };
