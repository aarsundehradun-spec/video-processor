const Queue = require('better-queue');
const { processFile } = require('./processor');

// Store job statuses in memory (in a real enterprise app, use Redis or a DB)
const jobStatuses = new Map();

// Periodically clean up old jobs from memory (older than 30 minutes)
setInterval(() => {
  const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);
  for (const [id, job] of jobStatuses.entries()) {
    if (job.timestamp && job.timestamp < thirtyMinsAgo) {
      jobStatuses.delete(id);
    }
  }
}, 15 * 60 * 1000);

const processingQueue = new Queue(async (task, cb) => {
  const { id } = task;
  
  try {
    // Update status to processing
    jobStatuses.set(id, { status: 'processing', progress: 0, timestamp: Date.now() });
    
    // Provide a way for processor to update progress
    task.updateProgress = (progress) => {
      const current = jobStatuses.get(id) || {};
      jobStatuses.set(id, { ...current, status: 'processing', progress, timestamp: Date.now() });
    };

    const outputPath = await processFile(task);
    
    jobStatuses.set(id, { 
      status: 'completed', 
      progress: 100, 
      result: outputPath,
      originalName: task.originalName || 'processed_file',
      timestamp: Date.now()
    });
    cb(null, outputPath);
  } catch (error) {
    console.error(`Job ${id} failed:`, error);
    jobStatuses.set(id, { status: 'failed', error: error.message, timestamp: Date.now() });
    cb(error);
  }
}, { concurrent: 1 }); // Serialize encodes: each job uses -threads 0 (all CPU cores).
                       // Running 2 concurrent encodes halves CPU per job — slower overall.
                       // Stream-copy (metadata-only) jobs are near-instant so serialization has no real cost.

module.exports = {
  processingQueue,
  jobStatuses
};
