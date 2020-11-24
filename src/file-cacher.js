const path = require('path');
const fs = require('fs-extra');
const PendingPromiseCache = require('./pending-promise-cache');
const FileSystemCache = require('./file-system-cache');
const FileMemCache = require('./file-mem-cache');
const assertFileType = require('./assert-file-type');

class CacheService {
  constructor({
    tmpDir = path.resolve('../tmp'),
    verbose = false,
    logger = console,
    maxFileSystemCacheSize = 1000,
    maxInMemoryCacheSize = 300,
  } = {}) {
    this.logger = logger;
    this._tmpFolderPath = tmpDir;
    this._verifyFolderExists();
    this._verbose = verbose;
    this._fileSystemCache = new FileSystemCache({ log: this._log.bind(this), tmpDir, maxFileSystemCacheSize });
    this._fileMemCache = new FileMemCache({ log: this._log.bind(this), maxInMemoryCacheSize });
    this._promises = new PendingPromiseCache({ log: this._log.bind(this) });
  }

  _verifyFolderExists() {
    fs.ensureDirSync(this._tmpFolderPath);
  }

  async _writeFile(filePath, fileContent) {
    this._log(`writeFile to path: ${filePath}`);

    try {
      await fs.ensureFile(filePath);
      await fs.writeFile(filePath, fileContent);
      this._log(`successfully wrote file: ${filePath}`);

      return fs.stat(filePath);
    } catch (err) {
      this._log('error _writeFile', err);
      throw err;
    }
  }

  _readFile(keyIdentifier, fileName) {
    const filePath = this._getFilePath(keyIdentifier, fileName);

    this._log(`readFile: ${filePath}`);

    return fs.readFile(filePath, 'utf-8').catch(err => {
      this._log('error _readFile', err);
      throw err;
    });
  }

  async _applyGetter(keyIdentifier, fileName, getter, fileCache) {
    this._log(`_applyGetter: ${fileName}`);

    const file = await getter();

    assertFileType(file);

    if (!fileCache) return file;

    this._fileMemCache.set(keyIdentifier, fileName, file);

    const filePath = this._getFilePath(keyIdentifier, fileName);
    const stat = await this._writeFile(filePath, file);

    await this._fileSystemCache.set(filePath, stat);

    return file;
  }

  _getFilePath(keyIdentifier, fileName) {
    return path.join(this._tmpFolderPath, keyIdentifier, fileName);
  }

  async _getOrSet(keyIdentifier, fileName, getter, fileCache) {
    if (!fileCache) return this._applyGetter(keyIdentifier, fileName, getter, fileCache);

    const filePath = this._getFilePath(keyIdentifier, fileName);
    const fileExists = await fs.exists(filePath);

    if (fileExists) {
      const file = await this._readFile(keyIdentifier, fileName);

      this._fileMemCache.set(keyIdentifier, fileName, file);

      return file;
    }

    this._log(`File does not exits: ${filePath}`);

    return this._applyGetter(keyIdentifier, fileName, getter, fileCache);
  }

  async get(keyIdentifier, fileName, getter, fileCache = true) {
    if (fileCache) {
      const fileFromMem = this._fileMemCache.get(keyIdentifier, fileName);

      if (fileFromMem) return fileFromMem;
    }

    const filePath = this._getFilePath(keyIdentifier, fileName);

    return this._promises.get(filePath, () => this._getOrSet(keyIdentifier, fileName, getter, fileCache));
  }

  _log(msg, err) {
    if (!this._verbose) return;

    if (err) {
      this.logger.error(msg, { err });
    } else {
      this.logger.info(msg);
    }
  }
}

module.exports = CacheService;
