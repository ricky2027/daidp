// metro.config.js
// Excludes onnxruntime-web and @ricky0123/vad-web from Metro bundling.
// These packages use dynamic import() and WASM which Metro cannot handle.
// They are loaded via CDN <script> tags at runtime instead (see pay.tsx).

const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Tell Metro to treat these as external — do not bundle them.
// Any import() of these packages will resolve to the global set by the CDN script.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "@ricky0123/vad-web" ||
    moduleName.startsWith("onnxruntime-web")
  ) {
    // Return an empty module — the real lib is loaded via CDN
    return {
      filePath: `${__dirname}/shims/empty-module.js`,
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;