/**
 * Vercel 部署版本
 * 适配 Vercel 的 Serverless Functions
 */

// 导入主逻辑
import { default as mainHandler } from '../src/index.js';

// Vercel 入口函数
export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // 创建模拟的 Cloudflare Worker 环境
  const mockEnv = {
    TG_BOT_TOKEN: process.env.TG_BOT_TOKEN || 'your_telegram_bot_token',
    TG_CHAT_ID: process.env.TG_CHAT_ID || 'your_telegram_chat_id'
  };
  
  // 创建模拟的 Request 对象
  const url = new URL(req.url, `https://${req.headers.host}`);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  });
  
  // 添加 Cloudflare 特定的属性
  request.cf = {
    country: req.headers['cf-ipcountry'] || 'CN' // 默认中国
  };
  
  try {
    // 调用主处理函数
    const response = await mainHandler.fetch(request, mockEnv);
    
    // 获取响应内容
    const body = await response.text();
    const status = response.status;
    const headers = Object.fromEntries(response.headers.entries());
    
    // 设置响应头
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // 发送响应
    res.status(status).send(body);
  } catch (error) {
    console.error('Vercel handler error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
