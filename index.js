
// Proxy to ESM-enabled library
require = require("esm")(module)
module.exports = require("./lib/sorter.js").default

