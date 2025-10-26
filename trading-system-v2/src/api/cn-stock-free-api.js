/**
 * A股免费数据源API
 * 使用akshare和东方财富API，完全免费
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

/**
 * akshare API客户端 (Python)
 */
class AkshareAPI {
  constructor() {
    this.pythonPath = 'python3'; // 默认python3
  }

  /**
   * 检查Python环境
   */
  async checkPythonEnv() {
    try {
      const { stdout } = await execAsync('which python3');
      logger.info(`Python环境: ${stdout.trim()}`);
      
      // 检查akshare是否安装
      try {
        await execAsync('python3 -c "import akshare"');
        logger.info('akshare已安装');
        return true;
      } catch (error) {
        logger.warn('akshare未安装，尝试安装...');
        await this.installAkshare();
        return true;
      }
    } catch (error) {
      logger.error(`Python环境检查失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 安装akshare
   */
  async installAkshare() {
    try {
      logger.info('正在安装akshare...');
      await execAsync('pip3 install akshare');
      logger.info('akshare安装成功');
    } catch (error) {
      logger.error(`akshare安装失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数日线数据
   * @param {string} code - 指数代码，如 '000300' (不含后缀)
   * @param {string} startDate - 开始日期 'YYYYMMDD'
   * @param {string} endDate - 结束日期 'YYYYMMDD'
   * @returns {Promise<Array>} K线数据
   */
  async getIndexDaily(code, startDate, endDate) {
    try {
      const pythonScript = `
import akshare as ak
import json
import sys

try:
    df = ak.index_zh_a_hist(
        symbol="${code}",
        period="daily",
        start_date="${startDate}",
        end_date="${endDate}"
    )
    
    # 转换为标准格式
    result = []
    for _, row in df.iterrows():
        result.append({
            'date': row['日期'],
            'open': float(row['开盘']),
            'high': float(row['最高']),
            'low': float(row['最低']),
            'close': float(row['收盘']),
            'volume': float(row['成交量']),
            'change_pct': float(row['涨跌幅'])
        })
    
    print(json.dumps(result))
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
`;

      const { stdout } = await execAsync(`python3 -c "${pythonScript}"`);
      const data = JSON.parse(stdout);
      return data;
    } catch (error) {
      logger.error(`获取指数日线数据失败: ${code}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数基本信息
   * @param {string} code - 指数代码
   * @returns {Promise<Object>} 指数基本信息
   */
  async getIndexInfo(code) {
    try {
      const pythonScript = `
import akshare as ak
import json

try:
    df = ak.tool_trade_date_hist_sina()
    print(json.dumps({'status': 'ok', 'data': df.to_dict()}))
except Exception as e:
    print(json.dumps({'status': 'error', 'message': str(e)}))
`;

      const { stdout } = await execAsync(`python3 -c "${pythonScript}"`);
      const data = JSON.parse(stdout);
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }
      
      return data.data;
    } catch (error) {
      logger.error(`获取指数信息失败: ${code}, ${error.message}`);
      throw error;
    }
  }
}

/**
 * 东方财富API客户端
 */
class EastMoneyAPI {
  /**
   * 获取指数K线数据
   * @param {string} secid - 指数secid，如 '1.000300' (沪市) 或 '0.399001' (深市)
   * @param {string} period - K线周期，101=日线，60=60分钟
   * @param {number} limit - 数据条数
   * @returns {Promise<Array>} K线数据
   */
  async getIndexKline(secid, period = '101', limit = 100) {
    try {
      const url = `http://push2his.eastmoney.com/api/qt/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${period}&fqt=1&lmt=${limit}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.data && data.data.klines) {
        return data.data.klines.map(k => {
          const [time, open, close, high, low, volume, amount, rate] = k.split(',');
          return {
            time,
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close),
            volume: parseFloat(volume),
            amount: parseFloat(amount),
            change_pct: parseFloat(rate)
          };
        });
      }
      
      return [];
    } catch (error) {
      logger.error(`获取东方财富K线失败: ${secid}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 转换指数代码为secid
   */
  getSecid(code) {
    // 000300.SH -> 1.000300
    // 399001.SZ -> 0.399001
    if (code.endsWith('.SH')) {
      return `1.${code.replace('.SH', '')}`;
    } else if (code.endsWith('.SZ')) {
      return `0.${code.replace('.SZ', '')}`;
    }
    return code;
  }
}

/**
 * 统一的A股免费数据源API
 */
class CNStockFreeAPI {
  constructor() {
    this.akshare = new AkshareAPI();
    this.eastMoney = new EastMoneyAPI();
    this.useAkshare = true; // 优先使用akshare
  }

  /**
   * 初始化
   */
  async initialize() {
    // 尝试使用akshare
    const akshareAvailable = await this.akshare.checkPythonEnv();
    if (!akshareAvailable) {
      logger.warn('akshare不可用，将使用东方财富API');
      this.useAkshare = false;
    }
  }

  /**
   * 获取指数日线数据
   */
  async getIndexDaily(code, startDate, endDate) {
    if (this.useAkshare) {
      return await this.getIndexDailyAkshare(code, startDate, endDate);
    } else {
      return await this.getIndexDailyEastMoney(code, startDate, endDate);
    }
  }

  /**
   * 使用akshare获取数据
   */
  async getIndexDailyAkshare(code, startDate, endDate) {
    // 去除后缀 .SH/.SZ
    const cleanCode = code.replace(/\.(SH|SZ)$/, '');
    return await this.akshare.getIndexDaily(cleanCode, startDate, endDate);
  }

  /**
   * 使用东方财富获取数据
   */
  async getIndexDailyEastMoney(code, startDate, endDate) {
    const secid = this.eastMoney.getSecid(code);
    return await this.eastMoney.getIndexKline(secid, '101', 100);
  }
}

module.exports = { AkshareAPI, EastMoneyAPI, CNStockFreeAPI };

