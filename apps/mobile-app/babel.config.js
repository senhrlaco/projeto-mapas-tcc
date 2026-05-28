// babel.config.js
// Configuracao do Babel para o projeto Expo.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
