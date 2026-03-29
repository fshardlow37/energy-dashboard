const { spawn, execSync } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
let child = null;

function bundle() {
  try {
    execSync('node scripts/bundle.js', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('Bundle failed:', e.message);
  }
}

function startElectron() {
  const electronPath = require('electron');
  child = spawn(electronPath, [ROOT], { stdio: 'inherit' });
  child.on('close', (code) => {
    if (code !== null && code !== 0) {
      console.log(`Electron exited with code ${code}`);
    }
    child = null;
  });
}

function restart() {
  console.log('\nRebuilding...');
  if (child) {
    child.on('close', () => {
      bundle();
      startElectron();
    });
    child.kill();
  } else {
    bundle();
    startElectron();
  }
}

// Initial launch
bundle();
startElectron();

// Watch for changes in src/ (excluding bundle.js)
const watcher = chokidar.watch(SRC, {
  ignoreInitial: true,
  ignored: [/bundle\.js$/, /\.map$/],
  awaitWriteFinish: { stabilityThreshold: 300 }
});

let debounce = null;
watcher.on('all', (event, filePath) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    console.log(`\n${event}: ${path.relative(ROOT, filePath)}`);
    restart();
  }, 500);
});

console.log('Watching src/ for changes...');
