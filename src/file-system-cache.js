const recursiveReadDir = require('recursive-readdir');
const fs = require('fs-extra');
const sortByLastUsed = require('./sort-by-last-used');

const bytesToMb = 1000000; // 1m

class FileSystemCache {
  constructor({ log, tmpDir, maxFileSystemCacheSize }) {
    this._tmpFolderPath = tmpDir;
    this._currentSystemFileCacheSize = 0;
    this._maxFileSystemCacheSizeInBytes = maxFileSystemCacheSize * bytesToMb;
    this._log = log;
    this._readDirPromise = this._initFileSystemCache();
  }

  _createFileStructure(filePath, stat) {
    const now = new Date();

    return {
      filePath,
      size: stat.size,
      created: stat.birthtime,
      lastUsed: now,
    };
  }

  async _verifyCapacity(lastOrderedFiles) {
    if (this._currentSystemFileCacheSize <= this._maxFileSystemCacheSizeInBytes) return;

    const orderedFiles = lastOrderedFiles || sortByLastUsed(this._filesMetaData);

    const [, oldestFileValue] = orderedFiles.shift();

    this._currentSystemFileCacheSize -= oldestFileValue.size;

    await fs.remove(oldestFileValue.filePath);

    await this._verifyCapacity(orderedFiles);
  }

  _addFileSize(fileStat) {
    this._currentSystemFileCacheSize += fileStat.size;
  }

  async set(filePath, stat) {
    await this._readDirPromise;
    this._filesMetaData[filePath] = this._createFileStructure(filePath, stat);
    this._addFileSize(stat);
    await this._verifyCapacity();
  }

  async _initFileSystemCache() {
    const folderContent = await recursiveReadDir(this._tmpFolderPath);

    this._filesMetaData = await folderContent.reduce(async (accFilesPromiseChain, filePath) => {
      const acc = await accFilesPromiseChain;
      const stat = await fs.stat(filePath);

      acc[filePath] = this._createFileStructure(filePath, stat);

      return acc;
    }, Promise.resolve({}));
    await this._verifyCapacity();
  }
}

module.exports = FileSystemCache;
