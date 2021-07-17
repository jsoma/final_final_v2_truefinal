module.exports = function (bundler) {
  bundler.addAssetType("gdoc", require.resolve("./gdoc-archieml-asset.js"));
};
