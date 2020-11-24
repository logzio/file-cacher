const sortByLastUsed = require('./sort-by-last-used');

const bytesToMb = 1000000; // 1m
// 1mb => 1,000,000 / 2 => ~ 500,000 chars
const convertMbToStringLength = mb => (mb * bytesToMb) / 2;

class FileMemCache {
  constructor({ maxInMemoryCacheSize, log }) {
    this._maxInMemoryCacheLength = convertMbToStringLength(maxInMemoryCacheSize);
    this._cachedFiles = {};
    this._log = log;
    this._currentLength = 0;
  }

  _createFileStructure(file) {
    const now = new Date();

    return {
      file,
      size: file.length,
      created: now,
      lastUsed: now,
    };
  }

  _verifyCapacity(lastOrderedFiles) {
    if (this._currentLength <= this._maxInMemoryCacheLength) return;

    const orderedFiles = lastOrderedFiles || sortByLastUsed(this._cachedFiles);

    const [oldestFileKey, oldestFileValue] = orderedFiles.shift();

    this._currentLength -= oldestFileValue.size;
    delete this._cachedFiles[oldestFileKey];

    this._verifyCapacity(orderedFiles);
  }

  _getFileKeyPath(keyIdentifier, fileName) {
    return `${keyIdentifier}.${fileName}`;
  }

  set(keyIdentifier, fileName, file) {
    const fileKeyPath = this._getFileKeyPath(keyIdentifier, fileName);
    const cachedFile = this._cachedFiles[fileKeyPath];

    this._log(`Saving file In Memory: ${fileKeyPath}`);

    if (cachedFile) {
      this._cachedFiles[fileKeyPath].lastUsed = new Date();

      return;
    }

    this._cachedFiles[fileKeyPath] = this._createFileStructure(file);
    this._currentLength += this._cachedFiles[fileKeyPath].size;
    this._verifyCapacity();
  }

  get(keyIdentifier, fileName) {
    const fileKeyPath = this._getFileKeyPath(keyIdentifier, fileName);
    const cachedFile = this._cachedFiles[fileKeyPath];

    if (!cachedFile) return null;

    this._log(`Get file from memory: ${keyIdentifier}/${fileName}`);

    return cachedFile.file;
  }
}

module.exports = FileMemCache;
