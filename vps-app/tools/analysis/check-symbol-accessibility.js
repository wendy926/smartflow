#!/usr/bin/env node

// 检查交易对可访问性脚本
const BinanceAPI = require('./modules/api/BinanceAPI');
const DatabaseManager = require('./modules/database/DatabaseManager');

class SymbolAccessibilityChecker {
  constructor() {
    this.db = null;
    this.inaccessibleSymbols = [];
  }

  async init() {
    this.db = new DatabaseManager();
    await this.db.init();
  }

  async checkSymbolAccessibility(symbol) {
    try {
      console.log(`🔍 检查交易对 ${symbol} 的可访问性...`);
      
      // 尝试获取K线数据
      const klines = await BinanceAPI.getKlines(symbol, '4h', 5);
      
      if (!klines || klines.length === 0) {
        console.log(`❌ ${symbol}: 无法获取K线数据`);
        return false;
      }
      
      console.log(`✅ ${symbol}: 可正常访问`);
      return true;
    } catch (error) {
      console.log(`❌ ${symbol}: ${error.message}`);
      
      // 记录无法访问的交易对
      if (error.message.includes('地理位置限制') || 
          error.message.includes('不存在或已下架') ||
          error.message.includes('网络连接失败')) {
        this.inaccessibleSymbols.push({
          symbol: symbol,
          reason: error.message
        });
      }
      
      return false;
    }
  }

  async checkAllSymbols() {
    console.log('🚀 开始检查所有交易对的可访问性...\n');
    
    // 获取所有自定义交易对
    const customSymbols = await this.db.getCustomSymbols();
    console.log(`📊 找到 ${customSymbols.length} 个自定义交易对:`, customSymbols);
    
    // 检查每个交易对
    for (const symbol of customSymbols) {
      await this.checkSymbolAccessibility(symbol);
      // 添加延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📋 检查结果汇总:');
    console.log(`✅ 可访问交易对: ${customSymbols.length - this.inaccessibleSymbols.length}`);
    console.log(`❌ 无法访问交易对: ${this.inaccessibleSymbols.length}`);
    
    if (this.inaccessibleSymbols.length > 0) {
      console.log('\n❌ 无法访问的交易对详情:');
      this.inaccessibleSymbols.forEach(item => {
        console.log(`  - ${item.symbol}: ${item.reason}`);
      });
      
      // 询问是否移除无法访问的交易对
      console.log('\n🔧 建议操作:');
      console.log('1. 移除无法访问的交易对');
      console.log('2. 保留交易对但显示错误信息');
      console.log('3. 手动处理');
      
      return this.inaccessibleSymbols;
    }
    
    return [];
  }

  async removeInaccessibleSymbols() {
    if (this.inaccessibleSymbols.length === 0) {
      console.log('✅ 没有需要移除的交易对');
      return;
    }
    
    console.log('\n🗑️ 开始移除无法访问的交易对...');
    
    for (const item of this.inaccessibleSymbols) {
      try {
        await this.db.removeCustomSymbol(item.symbol);
        console.log(`✅ 已移除交易对: ${item.symbol}`);
      } catch (error) {
        console.log(`❌ 移除交易对 ${item.symbol} 失败:`, error.message);
      }
    }
    
    console.log('\n🎉 交易对清理完成！');
  }

  async run() {
    try {
      await this.init();
      const inaccessibleSymbols = await this.checkAllSymbols();
      
      if (inaccessibleSymbols.length > 0) {
        // 自动移除无法访问的交易对
        await this.removeInaccessibleSymbols();
      }
      
    } catch (error) {
      console.error('❌ 检查过程出错:', error);
    } finally {
      if (this.db) {
        await this.db.close();
      }
    }
  }
}

// 运行检查
if (require.main === module) {
  const checker = new SymbolAccessibilityChecker();
  checker.run();
}

module.exports = SymbolAccessibilityChecker;
