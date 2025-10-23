/**
 * 统一时间处理工具
 * 确保整个系统使用UTC+8（中国北京时间）
 */

const TIMEZONE = 'Asia/Shanghai';
const TIMEZONE_OFFSET = '+08:00';

/**
 * 获取当前北京时间的Date对象
 * @returns {Date}
 */
function getNow() {
  return new Date();
}

/**
 * 获取北京时间的ISO字符串（用于API响应）
 * @param {Date} date - 日期对象，默认当前时间
 * @returns {string} 格式: 2025-10-10T15:30:00+08:00
 */
function toBeijingISO(date = new Date()) {
  // 获取UTC+8的ISO字符串
  const offset = 8 * 60; // +8小时的分钟数
  const beijingTime = new Date(date.getTime() + offset * 60 * 1000);
  const isoString = beijingTime.toISOString();
  // 替换Z为+08:00
  return isoString.replace('Z', '+08:00');
}

/**
 * 获取北京时间的友好格式字符串
 * @param {Date} date - 日期对象，默认当前时间
 * @returns {string} 格式: 2025-10-10 15:30:00
 */
function toBeijingString(date = new Date()) {
  return date.toLocaleString('zh-CN', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 获取北京时间的简短格式
 * @param {Date} date - 日期对象
 * @returns {string} 格式: 10-10 15:30
 */
function toBeijingShort(date = new Date()) {
  return date.toLocaleString('zh-CN', {
    timeZone: TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * 获取北京时间的日期部分
 * @param {Date} date - 日期对象
 * @returns {string} 格式: 2025-10-10
 */
function toBeijingDate(date = new Date()) {
  return date.toLocaleString('zh-CN', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
}

/**
 * 获取用于数据库的时间字符串（MySQL格式）
 * @param {Date} date - 日期对象，默认当前时间
 * @returns {string} 格式: 2025-10-10 15:30:00
 */
function toMySQLDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 解析字符串为Date对象（假定输入是北京时间）
 * @param {string} dateString - 日期字符串
 * @returns {Date}
 */
function parseBeijingTime(dateString) {
  if (!dateString) return null;
  
  // 如果已经是Date对象，直接返回
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // 解析字符串
  const date = new Date(dateString);
  
  // 检查是否有效
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

/**
 * 获取时区信息
 * @returns {Object}
 */
function getTimezoneInfo() {
  return {
    timezone: TIMEZONE,
    offset: TIMEZONE_OFFSET,
    name: '中国北京时间',
    abbreviation: 'CST (UTC+8)'
  };
}

/**
 * 格式化时间戳为相对时间（多久之前）
 * @param {string|Date} timestamp - 时间戳
 * @returns {string} 如: "5分钟前", "2小时前"
 */
function getTimeAgo(timestamp) {
  if (!timestamp) return '未知';
  
  try {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    
    if (diffMs < 0) return '未来时间';
    
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 30) return `${diffDays}天前`;
    
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}个月前`;
    
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears}年前`;
  } catch (error) {
    return '未知';
  }
}

module.exports = {
  // 核心方法
  getNow,
  toBeijingISO,
  toBeijingString,
  toBeijingShort,
  toBeijingDate,
  toMySQLDateTime,
  parseBeijingTime,
  
  // 辅助方法
  getTimezoneInfo,
  getTimeAgo,
  
  // 常量
  TIMEZONE,
  TIMEZONE_OFFSET
};

