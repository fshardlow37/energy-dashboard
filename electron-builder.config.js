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
  },
  mac: {
    target: ['dmg', 'zip'],
    icon: 'assets/icon.ico',
    artifactName: 'energysrc-${arch}.${ext}',
    category: 'public.app-category.utilities'
  },
  dmg: {
    artifactName: 'energysrc.dmg'
  },
  linux: {
    target: ['AppImage'],
    artifactName: 'energysrc.${ext}'
  }
};
