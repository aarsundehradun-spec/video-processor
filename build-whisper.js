const shell = require('shelljs');
const path = require('path');
const fs = require('fs');

console.log('[Build-Whisper] Checking if Whisper AI needs to be built...');

const whisperDir = path.join(__dirname, 'node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp');
if (!fs.existsSync(whisperDir)) {
  console.log('[Build-Whisper] nodejs-whisper not found, skipping.');
  process.exit(0);
}

// Add our local cmake to PATH just in case
process.env.PATH = process.env.PATH + ':' + path.join(__dirname, 'node_modules', '.bin') + ':/opt/homebrew/bin:/usr/local/bin';

const buildDir = path.join(whisperDir, 'build');
if (fs.existsSync(buildDir) && fs.existsSync(path.join(buildDir, 'bin', 'whisper-cli'))) {
  console.log('[Build-Whisper] Executable already built.');
  process.exit(0);
}

console.log('[Build-Whisper] Configuring CMake...');
shell.cd(whisperDir);
const configCmd = 'cmake -S . -B build -DCMAKE_BUILD_TYPE=Release';
if (shell.exec(configCmd).code !== 0) {
  console.error('[Build-Whisper] CMake configuration failed.');
  process.exit(1);
}

console.log('[Build-Whisper] Building with CMake (this may take a while)...');
const buildCmd = 'cmake --build build --config Release';
if (shell.exec(buildCmd).code !== 0) {
  console.error('[Build-Whisper] Build failed.');
  process.exit(1);
}

console.log('[Build-Whisper] Build successful!');
