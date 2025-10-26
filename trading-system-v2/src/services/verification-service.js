const crypto = require('crypto');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const DatabaseConnection = require('../database/connection');

const database = DatabaseConnection.getInstance ? DatabaseConnection.getInstance() : DatabaseConnection.default;

class VerificationService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  /**
   * 初始化邮件发送器
   */
  initTransporter() {
    // 使用环境变量配置邮件服务
    // 可以使用Gmail, Outlook等SMTP服务
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      logger.info('[验证码服务] 邮件发送器已初始化');
    } else {
      logger.warn('[验证码服务] SMTP配置未设置，将使用日志模式');
    }
  }

  /**
   * 生成6位数字验证码
   */
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationEmail(email, code) {
    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@smartflow.com',
      to: email,
      subject: 'SmartFlow 验证码',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">SmartFlow 验证码</h2>
          <p>您的验证码是：</p>
          <div style="font-size: 32px; font-weight: bold; color: #667eea; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">此验证码10分钟内有效，请勿泄露给他人。</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">如果您没有请求此验证码，请忽略此邮件。</p>
        </div>
      `
    };

    if (this.transporter) {
      try {
        await this.transporter.sendMail(mailOptions);
        logger.info(`[验证码服务] 验证码邮件已发送到: ${email}`);
        return true;
      } catch (error) {
        logger.error('[验证码服务] 邮件发送失败:', error);
        return false;
      }
    } else {
      // 开发模式：只在日志中显示验证码
      logger.info(`[验证码服务] 开发模式 - 验证码: ${code} for ${email}`);
      return true;
    }
  }

  /**
   * 创建验证码
   */
  async createCode(email, type = 'register') {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    await database.query(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, type, expiresAt]
    );

    logger.info(`[验证码服务] 验证码已创建: ${email} (${code})`);

    return code;
  }

  /**
   * 验证验证码
   */
  async verifyCode(email, code, type = 'register') {
    const result = await database.query(
      'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND type = ? AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
      [email, code, type]
    );

    if (result && result.length > 0) {
      // 标记验证码为已使用
      await database.query(
        'UPDATE verification_codes SET used = TRUE WHERE id = ?',
        [result[0].id]
      );

      logger.info(`[验证码服务] 验证码验证成功: ${email}`);
      return true;
    }

    logger.warn(`[验证码服务] 验证码验证失败: ${email}`);
    return false;
  }

  /**
   * 清理过期验证码
   */
  async cleanExpiredCodes() {
    await database.query(
      'DELETE FROM verification_codes WHERE expires_at < NOW()'
    );
  }

  /**
   * 发送验证码
   */
  async sendCode(email, type = 'register') {
    try {
      // 清理过期验证码
      await this.cleanExpiredCodes();

      // 创建新验证码
      const code = await this.createCode(email, type);

      // 发送邮件
      const sent = await this.sendVerificationEmail(email, code);
      
      if (sent) {
        return {
          success: true,
          message: '验证码已发送到您的邮箱'
        };
      } else {
        return {
          success: false,
          message: '验证码发送失败，请稍后重试'
        };
      }
    } catch (error) {
      logger.error('[验证码服务] 发送验证码失败:', error);
      return {
        success: false,
        message: '验证码发送失败'
      };
    }
  }
}

module.exports = new VerificationService();

