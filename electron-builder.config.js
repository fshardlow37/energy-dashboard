module.exports = {
  appId: 'com.energysrc.app',
  productName: 'energysrc',
  directories: {
    output: 'dist'
  },
  files: [
    'src/**/*',
    'node_modules/**/*',
    'package.json'
  ],
  win: {
    target: 'portable',
    icon: 'assets/icon.ico',
    artifactName: 'energysrc.exe',
    signAndEditExecutable: false
  },
  portable: {
    artifactName: 'energysrc.exe'
  }
};
