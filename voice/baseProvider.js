/**
 * Base Voice Provider
 * Interface that all TTS providers must implement
 */

class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * generateVoice — must be implemented by subclasses
   * @param {string} text — text to speak
   * @param {object} persona — { nickname, speed, emotion }
   * @returns {Promise<{audioBuffer: Buffer|null, format: string}>}
   */
  async generateVoice(text, persona = {}) {
    throw new Error('generateVoice() not implemented');
  }

  /**
   * isAvailable — check if provider can be used
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }
}

module.exports = BaseProvider;
