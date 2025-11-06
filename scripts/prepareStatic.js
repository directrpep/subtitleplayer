const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXPORT_DIR = path.join(PROJECT_ROOT, 'out');
const TARGET_DIR = path.join(PROJECT_ROOT, 'deploy', 'ppantoja', 'subtitleplayer');

function ensureExists(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function emptyDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyRecursive(source, destination) {
  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    ensureExists(destination);
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }
  ensureExists(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

function rewriteAssetPaths(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content
    .replace(/(["'])\/_next/g, '$1./_next')
    .replace(/(["'])\/favicon\.ico/g, '$1./favicon.ico');
  fs.writeFileSync(filePath, updated, 'utf8');
}

(function main() {
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error('Missing out/ directory. Run "next export" before prepareStatic.');
    process.exit(1);
  }

  emptyDir(path.join(PROJECT_ROOT, 'deploy'));
  ensureExists(TARGET_DIR);

  copyRecursive(EXPORT_DIR, TARGET_DIR);

  const htmlFiles = [];
  (function collect(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        collect(fullPath);
      } else if (entry.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  })(TARGET_DIR);

  htmlFiles.forEach(rewriteAssetPaths);

  console.log('Static site prepared at deploy/ppantoja/subtitleplayer');
})();
