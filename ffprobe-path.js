const os = require('os');
const path = require('path');
const fs = require('fs');
const ffprobeStatic = require('ffprobe-static');

let ffprobePath = ffprobeStatic.path; // Default cross-platform fallback

if (os.platform() === 'linux') {
  const customPath = path.join(__dirname, 'bin', 'ffprobe');
  if (fs.existsSync(customPath)) {
    ffprobePath = customPath;
  }
}

module.exports = ffprobePath;
