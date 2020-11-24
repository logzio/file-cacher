<p align="center">
  <a href="http://logz.io">
    <img height="150px" src="https://logz.io/wp-content/uploads/2017/06/new-logzio-logo.png">
  </a>
</p>

# File Cacher

## Description
This package will handle file caching for services in need for fast file access.
In essence, it will cache common files in memory, while less common files will be accessed from file system.

Additionally, it will cache similar requests promises. meaning, if two request for downloading the same file are being sent paralleled, it will only generate one request.

## Usage

```js

const fileCacher = new FileCacher({
      tmpDir: './tmp',
      debug : true,
      maxFileSystemCacheSize: 1000, // in MB
      maxInMemoryCacheSize: 300, // in MB
});


const filesGroupIdentifier = 'assets'

function getBundleFile() {
    const fileName = 'dist/bundle.aa8w37vhr.js';
    const fileUrl = `https://app.logz.io/${fileName}`;
    const fileGetter = () => fetch(fileUrl, { compress: true });
    
    return fileCacher.get(filesGroupIdentifier, fileName, fileGetter); 
}

getFile()
    .then(file => {
        console.log(file);
    })

```
