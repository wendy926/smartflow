const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const DatabaseConnection = require('../../database/connection');

const router = express.Router();
const database = DatabaseConnection.getInstance ? DatabaseConnection.getInstance() : DatabaseConnection.default;

/**
 * 用户注册
 * POST /api/v1/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, company, phone } = req.body;

    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '邮箱和密码不能为空'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '邮箱格式不正确'
      });
    }

    // 验证密码长度
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '密码长度至少8位'
      });
    }

    // 检查邮箱是否已存在
    const [existingUsers] = await database.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: '该邮箱已被注册'
      });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 创建用户
    const [result] = await database.query(
      'INSERT INTO users (email, password_hash, name, company, phone) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, name || null, company || null, phone || null]
    );

    logger.info(`新用户注册: ${email}`);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        userId: result.insertId,
        email
      }
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '注册失败，请稍后重试'
    });
  }
});

/**
 * 用户登录
 * POST /api/v1/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '邮箱和密码不能为空'
      });
    }

    // 查询用户
    const [users] = await database.query(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '邮箱或密码错误'
      });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '邮箱或密码错误'
      });
    }

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // 生成refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // 保存会话
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天
    await database.query(
      'INSERT INTO user_sessions (user_id, token, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
      [user.id, token, refreshToken, expiresAt]
    );

    // 更新最后登录时间
    await database.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    logger.info(`用户登录: ${email}`);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          company: user.company
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '登录失败，请稍后重试'
    });
  }
});

/**
 * 用户退出
 * POST /api/v1/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      // 删除会话
      await database.query(
        'DELETE FROM user_sessions WHERE token = ?',
        [token]
      );
    }

    res.json({
      success: true,
      message: '退出成功'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '退出失败'
    });
  }
});

/**
 * 获取当前用户信息
 * GET /api/v1/auth/me
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '未授权'
      });
    }

    const [users] = await database.query(
      'SELECT id, email, name, company, phone, created_at, last_login_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '获取用户信息失败'
    });
  }
});

/**
 * 提交联系方式（商机）
 * POST /api/v1/auth/contact
 */
router.post('/contact', async (req, res) => {
  try {
    const { name, email, company, phone, message, source } = req.body;

    // 验证必填字段
    if (!name || !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '姓名和邮箱不能为空'
      });
    }

    // 插入联系信息
    await database.query(
      'INSERT INTO contact_submissions (name, email, company, phone, message, source) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, company || null, phone || null, message || null, source || 'homepage']
    );

    logger.info(`收到联系信息: ${email}`);

    res.status(201).json({
      success: true,
      message: '提交成功，我们会尽快与您联系'
    });
  } catch (error) {
    logger.error('Contact submission error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '提交失败，请稍后重试'
    });
  }
});

module.exports = router;

