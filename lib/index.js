"use strict";
const MideaPlatform_1 = require("./MideaPlatform");
module.exports = (api) => {
    api.registerPlatform('midea', MideaPlatform_1.MideaPlatform);
};
