const fs = require('node:fs');
const path = require('node:path');

const routerRoot = path.resolve(__dirname, '../node_modules/expo-router');
const routerPackage = require(path.join(routerRoot, 'package.json'));
const queryStringPackage = require('../node_modules/query-string/package.json');

// shortcut: pinned Expo Router 57 CommonJS interop, refresh this patch on Router upgrades.
if (routerPackage.version !== '57.0.26' || queryStringPackage.version !== '9.5.1') {
  throw new Error('Review the Expo Router query-string interop patch after dependency updates.');
}

const unpatched = 'const queryString = __importStar(require("query-string"));';
const patched = 'const queryStringModule = require("query-string");\nconst queryString = queryStringModule.parse ? queryStringModule : queryStringModule.default;';

for (const relativePath of [
  'build/react-navigation/core/getPathFromState.js',
  'build/react-navigation/core/getStateFromPath.js',
]) {
  const filePath = path.join(routerRoot, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(patched)) continue;
  if (source.split(unpatched).length !== 2) {
    throw new Error(`Unexpected Expo Router query-string import in ${relativePath}`);
  }
  fs.writeFileSync(filePath, source.replace(unpatched, patched));
}
