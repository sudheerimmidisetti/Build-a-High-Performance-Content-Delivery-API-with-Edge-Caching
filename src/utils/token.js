const crypto = require('crypto');

function createSecureToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

module.exports = {
  createSecureToken,
};
