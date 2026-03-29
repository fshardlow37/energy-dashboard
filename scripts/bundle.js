const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(__dirname, '..', 'src', 'renderer', 'app.js')],
  bundle: true,
  outfile: path.join(__dirname, '..', 'src', 'renderer', 'bundle.js'),
  platform: 'browser',
  format: 'iife',
  sourcemap: true,
  external: ['electron'],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

if (watch) {
  esbuild.context(options).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  esbuild.buildSync(options);
  console.log('Bundle built.');
}
