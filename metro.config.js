const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * expo-sqlite's web build loads wa-sqlite.wasm, and Metro does not treat .wasm
 * as an asset by default — so `expo start --web` fails to bundle without this.
 *
 * That matters because the browser is Layer B of the test plan: the fast loop
 * for checking layout, type scale and contrast without a phone.
 */
config.resolver.assetExts.push('wasm');

module.exports = config;
