// Keep the bot's Chrome inside the project: ~/.cache can be cleared by cleanup tools.
const { join } = require('path');
module.exports = { cacheDirectory: join(__dirname, '.cache', 'puppeteer') };
