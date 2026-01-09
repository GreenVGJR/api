"use strict";

const fs = require('fs');
const path = require('path');

const routes = [];

fs.readdirSync(__dirname).forEach(file => {
    if (file.endsWith('.js') && file !== 'index.js' && file !== 'request.js') {
        const route = require(path.join(__dirname, file));
        routes.push(route);
    }
});

module.exports = routes;
