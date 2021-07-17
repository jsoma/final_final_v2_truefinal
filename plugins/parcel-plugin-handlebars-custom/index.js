'use strict'

/* -----------------------------------------------------------------------------
 * parcel-plugin-handlebars
 * -------------------------------------------------------------------------- */

module.exports = bundler => {
  bundler.addAssetType('hbs', require.resolve('./lib/handlebars-asset'))
  bundler.addAssetType('handlebars', require.resolve('./lib/handlebars-asset'))
  bundler.addAssetType('html', require.resolve('./lib/handlebars-asset'))
}
