module.exports = function assertFileType(file) {
  const typeOfFile = typeof file;

  if (typeOfFile !== 'string') throw new Error(`File type must be a string, received:${typeOfFile}`);
};
