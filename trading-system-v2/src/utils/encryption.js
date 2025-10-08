/**
 * 加密工具模块
 * 用于敏感数据（如API Key）的加密和解密
 */

const crypto = require('crypto');

/**
 * 加密工具类
 */
class Encryption {
  constructor() {
    // 使用环境变量或默认密钥（生产环境必须设置）
    this.algorithm = 'aes-256-cbc';
    this.secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production-32bytes';
    
    // 确保密钥长度为32字节
    this.key = crypto.createHash('sha256').update(this.secretKey).digest();
  }

  /**
   * 加密文本
   * @param {string} text - 待加密的文本
   * @returns {string} - 加密后的文本（格式：iv:encryptedData）
   */
  encrypt(text) {
    try {
      if (!text) {
        throw new Error('待加密文本不能为空');
      }

      // 生成随机初始化向量
      const iv = crypto.randomBytes(16);
      
      // 创建加密器
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // 加密数据
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // 返回格式：iv:encryptedData
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`加密失败: ${error.message}`);
    }
  }

  /**
   * 解密文本
   * @param {string} encryptedText - 加密的文本（格式：iv:encryptedData）
   * @returns {string} - 解密后的文本
   */
  decrypt(encryptedText) {
    try {
      if (!encryptedText) {
        throw new Error('待解密文本不能为空');
      }

      // 分离IV和加密数据
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('加密文本格式错误');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];
      
      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      // 解密数据
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`解密失败: ${error.message}`);
    }
  }

  /**
   * 生成随机密钥
   * @param {number} length - 密钥长度（字节）
   * @returns {string} - 十六进制格式的随机密钥
   */
  static generateKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 哈希文本（单向加密）
   * @param {string} text - 待哈希的文本
   * @param {string} algorithm - 哈希算法（默认sha256）
   * @returns {string} - 哈希值
   */
  static hash(text, algorithm = 'sha256') {
    try {
      if (!text) {
        throw new Error('待哈希文本不能为空');
      }
      return crypto.createHash(algorithm).update(text).digest('hex');
    } catch (error) {
      throw new Error(`哈希失败: ${error.message}`);
    }
  }

  /**
   * 验证哈希值
   * @param {string} text - 原始文本
   * @param {string} hash - 哈希值
   * @param {string} algorithm - 哈希算法
   * @returns {boolean} - 是否匹配
   */
  static verifyHash(text, hash, algorithm = 'sha256') {
    try {
      const computedHash = this.hash(text, algorithm);
      return computedHash === hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * 脱敏显示（用于日志）
   * @param {string} text - 原始文本
   * @param {number} visibleStart - 开头可见字符数
   * @param {number} visibleEnd - 结尾可见字符数
   * @returns {string} - 脱敏后的文本
   */
  static mask(text, visibleStart = 4, visibleEnd = 4) {
    if (!text || text.length <= visibleStart + visibleEnd) {
      return '***';
    }
    
    const start = text.substring(0, visibleStart);
    const end = text.substring(text.length - visibleEnd);
    const maskLength = text.length - visibleStart - visibleEnd;
    const mask = '*'.repeat(Math.min(maskLength, 10));
    
    return `${start}${mask}${end}`;
  }
}

// 导出单例
module.exports = new Encryption();
module.exports.Encryption = Encryption;

