function normalizeEtag(value) {
  if (!value) {
    return '';
  }

  return String(value).trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
}

function matchesIfNoneMatch(ifNoneMatch, currentEtag) {
  if (!ifNoneMatch || !currentEtag) {
    return false;
  }

  const candidates = String(ifNoneMatch)
    .split(',')
    .map((entry) => entry.trim());
  if (candidates.includes('*')) {
    return true;
  }

  const normalizedCurrent = normalizeEtag(currentEtag);
  return candidates.some(
    (candidate) => normalizeEtag(candidate) === normalizedCurrent,
  );
}

module.exports = {
  matchesIfNoneMatch,
};
