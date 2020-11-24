class PendingPromiseCache {
  constructor({ log = () => {} } = {}) {
    this.cache = {};
    this._log = log;
  }

  get(key, getter) {
    if (!this.cache[key]) {
      this._log(`Saved promise in cache: ${key}`);
      this.cache[key] = getter();
    } else {
      this._log(`Getting promise from cache: ${key}`);
    }

    return this.cache[key].finally(() => {
      delete this.cache[key];
    });
  }
}

module.exports = PendingPromiseCache;
