module.exports = function sortByLastUsed(filesMap) {
  return Object.entries(filesMap).sort(([, v1], [, v2]) => v1.lastUsed - v2.lastUsed);
};
