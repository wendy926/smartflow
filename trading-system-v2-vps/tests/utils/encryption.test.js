/**
 * 加密工具单元测试
 */

const encryption = require('../../src/utils/encryption');
const { Encryption } = require('../../src/utils/encryption');

describe('Encryption', () => {
  describe('encrypt and decrypt', () => {
    test('应该正确加密和解密文本', () => {
      const originalText = 'Hello, World!';
      const encrypted = encryption.encrypt(originalText);
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });

    test('加密后的文本应该包含IV和密文', () => {
      const originalText = 'Test text';
      const encrypted = encryption.encrypt(originalText);

      // 格式应该是 iv:encryptedData
      expect(encrypted).toContain(':');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(2);
    });

    test('相同文本每次加密结果应该不同（因为IV随机）', () => {
      const text = 'Same text';
      const encrypted1 = encryption.encrypt(text);
      const encrypted2 = encryption.encrypt(text);

      expect(encrypted1).not.toBe(encrypted2);
      
      // 但解密后应该相同
      expect(encryption.decrypt(encrypted1)).toBe(text);
      expect(encryption.decrypt(encrypted2)).toBe(text);
    });

    test('空文本应该抛出错误', () => {
      expect(() => encryption.encrypt('')).toThrow();
      expect(() => encryption.decrypt('')).toThrow();
    });

    test('无效的加密文本应该抛出错误', () => {
      expect(() => encryption.decrypt('invalid')).toThrow();
      expect(() => encryption.decrypt('invalid:format:here')).toThrow();
    });
  });

  describe('hash', () => {
    test('应该正确生成哈希值', () => {
      const text = 'password123';
      const hash1 = Encryption.hash(text);
      const hash2 = Encryption.hash(text);

      // 相同文本的哈希应该相同
      expect(hash1).toBe(hash2);
      
      // 哈希应该是64字符的十六进制字符串（SHA256）
      expect(hash1).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash1)).toBe(true);
    });

    test('不同文本的哈希应该不同', () => {
      const hash1 = Encryption.hash('text1');
      const hash2 = Encryption.hash('text2');

      expect(hash1).not.toBe(hash2);
    });

    test('空文本应该抛出错误', () => {
      expect(() => Encryption.hash('')).toThrow();
    });
  });

  describe('verifyHash', () => {
    test('应该正确验证哈希值', () => {
      const text = 'password123';
      const hash = Encryption.hash(text);

      expect(Encryption.verifyHash(text, hash)).toBe(true);
      expect(Encryption.verifyHash('wrong', hash)).toBe(false);
    });
  });

  describe('mask', () => {
    test('应该正确脱敏显示文本', () => {
      const text = 'sk-1234567890abcdef';
      const masked = Encryption.mask(text);

      // 应该包含开头和结尾的字符
      expect(masked).toContain('sk-1');
      expect(masked).toContain('cdef');
      expect(masked).toContain('*');
    });

    test('短文本应该完全脱敏', () => {
      const text = 'abc';
      const masked = Encryption.mask(text);

      expect(masked).toBe('***');
    });

    test('可以自定义可见字符数', () => {
      const text = 'abcdefghijklmnop';
      const masked = Encryption.mask(text, 2, 2);

      expect(masked).toContain('ab');
      expect(masked).toContain('op');
      expect(masked).toContain('*');
    });
  });

  describe('generateKey', () => {
    test('应该生成指定长度的随机密钥', () => {
      const key1 = Encryption.generateKey(32);
      const key2 = Encryption.generateKey(32);

      // 两次生成的密钥应该不同
      expect(key1).not.toBe(key2);
      
      // 长度应该是64个字符（32字节的十六进制表示）
      expect(key1).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(key1)).toBe(true);
    });

    test('应该支持不同长度', () => {
      const key16 = Encryption.generateKey(16);
      const key64 = Encryption.generateKey(64);

      expect(key16).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(key64).toHaveLength(128); // 64 bytes = 128 hex chars
    });
  });
});

