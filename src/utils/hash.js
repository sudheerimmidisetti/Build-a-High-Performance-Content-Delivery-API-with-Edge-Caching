const crypto = require('crypto');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function toStrongEtag(hash) {
  return `"${hash}"`;
}

module.exports = {
  sha256,
  toStrongEtag,
};
