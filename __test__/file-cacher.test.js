const path = require('path');
const mock = require('mock-fs');
const fs = require('fs-extra');
const { to } = require('await-to-js');
const rimraf = require('rimraf');
const FileCacher = require('../src/file-cacher');

const commonFileCacherOptions = {
  tmpDir: path.join(__dirname, 'tmp'),
  verbose: true,
};

const delay = time => new Promise(resolve => setTimeout(resolve, time));

const fileContent = (randomness = randInt()) => `file with rand ${randomness}`;

const fileGetter = randomness => async () => {
  await delay(1);

  return fileContent(randomness);
};

const randInt = () => Math.floor(Math.random() * 100000);
const fileNameGenerator = () => `some-file.${randInt()}.js`;
const fileLength = fileContent(0).length;
const fileSizeInMb = (fileLength / 1000000) * 2;

describe('File Cacher', () => {
  beforeAll(() => {
    mock();
  });
  beforeEach(() => {
    rimraf.sync(commonFileCacherOptions.tmpDir);
  });

  afterAll(() => {
    rimraf.sync(commonFileCacherOptions.tmpDir);
    mock.restore();
  });

  const identifier = 'some-identifier';

  describe('File Getter', () => {
    test('should generate the right path for a file', () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);
      const fileName = fileNameGenerator();
      const filePath = fileCacher._getFilePath(identifier, fileName);

      expect(filePath).toContain(`tmp/some-identifier/${fileName}`);
    });

    test('should write a file', async () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);
      const fileName = fileNameGenerator();
      const filePath = fileCacher._getFilePath(identifier, fileName);

      await fileCacher._writeFile(filePath, fileContent());
      expect(fs.statSync(filePath).size).toBeGreaterThan(10);
    });

    test('should write a file with sub folder structure', async () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);
      const fileName = `some-path/${fileNameGenerator()}`;
      const filePath = fileCacher._getFilePath(identifier, fileName);

      await fileCacher._writeFile(filePath, fileContent());

      expect(fs.statSync(filePath).size).toBeGreaterThan(10);
    });

    test('should create a file that doesnt exists with getter', async () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);
      const fileName = fileNameGenerator();

      const file = await fileCacher.get(identifier, fileName, fileGetter(1));

      expect(file).toEqual(fileContent(1));
    });

    test('should get a file from cache', async () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);
      const fileName = fileNameGenerator();
      const seedA = 1;
      const seedB = 2;

      const file = await fileCacher.get(identifier, fileName, fileGetter(seedA));
      const sameFile = await fileCacher.get(identifier, fileName, fileGetter(seedB));

      expect(file).toEqual(fileContent(seedA));
      expect(sameFile).toEqual(fileContent(seedA));
    });

    test('should get a file request from promise cache', async () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);
      const fileName = fileNameGenerator();
      const seedA = 3;
      const seedB = 4;

      const filePromise = fileCacher.get(identifier, fileName, fileGetter(seedA));
      const sameFilePromise = fileCacher.get(identifier, fileName, fileGetter(seedB));

      expect(filePromise).toEqual(sameFilePromise);

      const [file, sameFile] = await Promise.all([filePromise, sameFilePromise]);

      expect(file).toEqual(fileContent(seedA));
      expect(sameFile).toEqual(fileContent(seedA));
    });

    test('should handle errors', async () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);
      const fileName = fileNameGenerator();

      const message = 'i am an error';
      const throwErr = async () => {
        throw new Error(message);
      };
      const [err] = await to(fileCacher.get(identifier, fileName, throwErr));

      expect(err.message).toEqual(message);
    });
  });

  describe('In Memory Cache', () => {
    test('should sum up mem length', async () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);

      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(1));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(2));

      expect(fileCacher._fileMemCache._currentLength).toEqual(32);
    });

    test('should delete in memory cached file if pass limit', async () => {
      const fileCountToSaveInMemory = 2;
      const maxInMemoryCacheSize = fileCountToSaveInMemory * fileSizeInMb;
      const fileCacher = new FileCacher({ ...commonFileCacherOptions, maxInMemoryCacheSize });

      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(1));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(2));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(3));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(4));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(5));

      expect(fileCacher._fileMemCache._currentLength).toEqual(fileLength * fileCountToSaveInMemory);
      expect(Object.keys(fileCacher._fileMemCache._cachedFiles)).toHaveLength(fileCountToSaveInMemory);
    });

    test('should drop if file is too large', async () => {
      const maxInMemoryCacheSize = 0;
      const fileCacher = new FileCacher({ ...commonFileCacherOptions, maxInMemoryCacheSize });

      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(1));

      expect(Object.keys(fileCacher._fileMemCache._cachedFiles)).toHaveLength(0);
    });
  });

  describe('File System Cache', () => {
    test('should sum file system cache', async () => {
      const fileCacher = new FileCacher({ ...commonFileCacherOptions, maxFileSystemCacheSize: 1 });

      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(1));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(2));

      expect(fileCacher._fileSystemCache._currentSystemFileCacheSize).toEqual(32);
    });

    test('should delete files from file system if pass limit', async () => {
      const fileCacher = new FileCacher({ ...commonFileCacherOptions, maxFileSystemCacheSize: fileSizeInMb });

      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(1));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(2));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(3));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(4));

      expect(fileCacher._fileSystemCache._currentSystemFileCacheSize).toBeLessThanOrEqual(fileSizeInMb * 1000000);
    });

    test('should accumulate files in file system cache', async () => {
      const fileCacher = new FileCacher(commonFileCacherOptions);

      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(1));
      await fileCacher.get(identifier, fileNameGenerator(), fileGetter(2));

      const fileSystemFilesMetaDataValues = Object.values(fileCacher._fileSystemCache._filesMetaData);

      expect(fileSystemFilesMetaDataValues).toHaveLength(2);
      expect(Date.now() - new Date(fileSystemFilesMetaDataValues[0].created)).toBeGreaterThanOrEqual(0);
    });

    test('should load files on init', async () => {
      const filePath = `${commonFileCacherOptions.tmpDir}/${fileNameGenerator()}`;
      const filePathWithSubDirs = `${commonFileCacherOptions.tmpDir}/sub-dir/${fileNameGenerator()}`;

      await fs.ensureFile(filePath);
      await fs.ensureFile(filePathWithSubDirs);
      await fs.writeFile(filePath, fileContent(), 'utf-8');
      await fs.writeFile(filePathWithSubDirs, fileContent(), 'utf-8');

      const fileCacher = new FileCacher(commonFileCacherOptions);

      await fileCacher._fileSystemCache._readDirPromise;
      expect(fileCacher._fileSystemCache._filesMetaData[filePath].filePath).toBe(filePath);
      expect(fileCacher._fileSystemCache._filesMetaData[filePathWithSubDirs].filePath).toBe(filePathWithSubDirs);
    });
  });
});
