const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const path = require('path');
const fs = require('fs');
const os = require('os');
const { processingQueue } = require('./queue');

const router = express.Router();

// Use /tmp for ALL file storage — always writable on any Linux/cloud server
const TMP_DIR = os.tmpdir();
const UPLOADS_DIR = path.join(TMP_DIR, 'meta-remover-uploads');
const OUTPUTS_DIR = path.join(TMP_DIR, 'meta-remover-outputs');

// Create directories if they don't exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

console.log('[Routes] Upload dir:', UPLOADS_DIR);
console.log('[Routes] Output dir:', OUTPUTS_DIR);

// Multer configuration using /tmp
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Secure UUID filename — prevents path traversal
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});

// Accept both 'file' (video) and 'audio' (optional voiceover/background)
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit (free tier safe)
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
]);

// Upload endpoint
router.post('/upload', upload, async (req, res) => {
  const files = req.files || {};
  if (!files.file || files.file.length === 0) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const videoFile = files.file[0];
  const audioFile = files.audio ? files.audio[0] : null;

  const jobId = uuidv4();
  const inputPath = videoFile.path;

  // Always output as mp4 for transform mode (re-encode), preserve original ext for metadata mode if valid
  const mode = (req.body.mode || 'metadata').trim();
  const rawExt = path.extname(videoFile.originalname).toLowerCase();
  
  // Strict whitelist of safe extensions to prevent ffmpeg from misinterpreting the output format
  // or crashing with "Error opening output file part." on files like "video.part"
  const SAFE_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv', '.3gp', '.jpg', '.jpeg']);
  const originalExt = SAFE_EXTS.has(rawExt) ? rawExt : '.mp4';
  
  const outputExt = mode === 'transform' ? '.mp4' : originalExt;
  const outputPath = path.join(OUTPUTS_DIR, `${jobId}${outputExt}`);

  console.log(`[Routes] Job ${jobId} mode="${mode}": ${videoFile.mimetype} → ${outputPath}`);

  // Parse custom metadata fields (used by both modes)
  const customMeta = {
    title:        (req.body.title        || '').trim(),
    author:       (req.body.author       || '').trim(),
    comment:      (req.body.comment      || '').trim(),
    copyright:    (req.body.copyright    || '').trim(),
    creationTime: (req.body.creationTime || '').trim(),
  };

  // Parse transform options (only used in transform mode)
  const transformOptions = {
    // Inherit metadata
    ...customMeta,

    // Trim
    trimStart:   req.body.trimStart   != null && req.body.trimStart   !== '' ? parseFloat(req.body.trimStart)   : null,
    trimEnd:     req.body.trimEnd     != null && req.body.trimEnd     !== '' ? parseFloat(req.body.trimEnd)     : null,

    // Crop
    cropEnabled: req.body.cropEnabled === 'true',
    cropWidth:   parseInt(req.body.cropWidth, 10) || null,
    cropHeight:  parseInt(req.body.cropHeight, 10) || null,
    cropX:       parseInt(req.body.cropX, 10) || 0,
    cropY:       parseInt(req.body.cropY, 10) || 0,

    // Watermark
    watermarkEnabled: req.body.watermarkEnabled === 'true',
    watermarkWidth:   parseInt(req.body.watermarkWidth, 10) || null,
    watermarkHeight:  parseInt(req.body.watermarkHeight, 10) || null,
    watermarkX:       parseInt(req.body.watermarkX, 10) || 0,
    watermarkY:       parseInt(req.body.watermarkY, 10) || 0,

    // Speed
    speed:       parseFloat(req.body.speed || '1.0'),

    // Color
    colorPreset: (req.body.colorPreset || 'none').trim(),
    saturation:  parseFloat(req.body.saturation  || '1.0'),
    brightness:  parseFloat(req.body.brightness  || '0.0'),
    contrast:    parseFloat(req.body.contrast    || '1.0'),

    // Captions
    captionText:     (req.body.captionText     || '').trim(),
    captionPosition: (req.body.captionPosition || 'bottom').trim(),
    captionSize:     parseInt(req.body.captionSize || '36', 10),
    captionColor:    (req.body.captionColor    || 'white').trim(),

    // Auto Subtitles (AI)
    autoSubtitles:   req.body.autoSubtitles === 'true',

    // Audio
    audioMode:   (req.body.audioMode   || 'keep').trim(),
    audioVolume: parseFloat(req.body.audioVolume || '0.3'),
    audioPath:   audioFile ? audioFile.path : null,
  };

  // Output name for download — always use .mp4 for transform
  const outputOriginalName = mode === 'transform'
    ? path.basename(videoFile.originalname, originalExt) + '_transformed.mp4'
    : videoFile.originalname;

  const jobData = {
    id: jobId,
    inputPath,
    outputPath,
    mimeType: videoFile.mimetype,
    originalName: outputOriginalName,
    customMeta,
    transformOptions,
    mode,
  };

  // Add job to BullMQ
  await processingQueue.add('video-process', jobData, { jobId });

  res.status(202).json({ jobId, message: 'File queued for processing' });
});

// Status endpoint
router.get('/status/:id', async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await processingQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const state = await job.getState();
    const progress = job.progress || 0;
    
    let status = 'queued';
    if (state === 'active') status = 'processing';
    if (state === 'completed') status = 'completed';
    if (state === 'failed') status = 'failed';
    
    res.json({
      status,
      progress,
      result: job.returnvalue ? job.returnvalue.outputPath : null,
      originalName: job.returnvalue ? job.returnvalue.originalName : null,
      error: job.failedReason
    });
  } catch (error) {
    console.error(`[Routes] Error fetching job status:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Download endpoint
router.get('/download/:id', async (req, res) => {
  const jobId = req.params.id;
  
  try {
    const job = await processingQueue.getJob(jobId);
    if (!job || await job.getState() !== 'completed') {
      return res.status(400).json({ error: 'File not ready or job failed' });
    }

    const filePath = job.returnvalue.outputPath;
    const originalName = job.returnvalue.originalName || 'processed_file';

    console.log(`[Routes] Download requested: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.error(`[Routes] File missing: ${filePath}`);
      return res.status(404).json({ error: 'File not found on server. Please re-upload and try again.' });
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const contentType = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';

    // Set headers explicitly — required for cross-origin fetch() downloads
    res.set({
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
    });

    // Stream the file to avoid loading the entire thing into memory
    const stream = fs.createReadStream(filePath);

    stream.on('error', (err) => {
      console.error('[Routes] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error(`[Routes] Error downloading file:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = { router };
