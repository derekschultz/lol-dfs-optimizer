const { override } = require('customize-cra');

module.exports = override(
  // Add webpack config overrides here
  function(config) {
    // Add fallbacks for node core modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "fs": false,
      "os": false,
      "path": false,
      "crypto": false
    };

    return config;
  }
);