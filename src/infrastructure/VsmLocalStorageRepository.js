/**
 * VSM LocalStorage Repository (Google Apps Script Safe)
 * Includes try/catch safety and memory fallback for third-party iframe restrictions
 */

class VsmLocalStorageRepository {
  constructor(key = 'vsm_data') {
    this.key = key
    this.memoryStorage = null
  }

  // Kiểm tra an toàn xem trình duyệt/iframe có cho phép dùng LocalStorage không
  isLocalStorageAvailable() {
    try {
      const testKey = '__vsm_test__'
      window.localStorage.setItem(testKey, testKey)
      window.localStorage.removeItem(testKey)
      return true
    } catch (e) {
      return false
    }
  }

  /**
   * Load VSM data from localStorage or memory fallback
   * @param {Object} initialState
   * @param {Function} [sanitizer]
   * @returns {Object}
   */
  load(initialState, sanitizer) {
    try {
      if (this.isLocalStorageAvailable()) {
        const item = window.localStorage.getItem(this.key)
        if (item) {
          const parsed = JSON.parse(item)
          return sanitizer ? sanitizer(parsed) : parsed
        }
      } else if (this.memoryStorage) {
        return sanitizer ? sanitizer(this.memoryStorage) : this.memoryStorage
      }
    } catch (err) {
      console.warn('LocalStorage load failed, fallback to initial state:', err)
    }
    return initialState
  }

  /**
   * Save VSM data to localStorage or memory fallback
   * @param {Object} data
   */
  save(data) {
    try {
      if (this.isLocalStorageAvailable()) {
        window.localStorage.setItem(this.key, JSON.stringify(data))
      } else {
        this.memoryStorage = data
      }
    } catch (err) {
      console.warn('LocalStorage save failed, using memory fallback:', err)
      this.memoryStorage = data
    }
  }
}

export const vsmLocalStorageRepo = new VsmLocalStorageRepository()