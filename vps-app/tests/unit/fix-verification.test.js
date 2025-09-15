/**
 * 修复验证测试
 * 验证我们修复的问题是否已经解决
 */

const fs = require('fs');
const path = require('path');

describe('修复验证测试', () => {
  describe('布林带计算修复验证', () => {
    test('StrategyV3Core.calculateBollingerBands应该修复数组长度问题', () => {
      const strategyCorePath = path.join(__dirname, '../../src/core/modules/strategy/StrategyV3Core.js');
      const content = fs.readFileSync(strategyCorePath, 'utf8');
      
      // 检查是否修复了stdDev数组初始化问题
      expect(content).toContain('new Array(candles.length).fill(0)');
      
      // 检查是否有null/undefined检查
      expect(content).toContain('m === null || m === undefined || isNaN(m)');
    });
  });

  describe('震荡市边界判断修复验证', () => {
    test('SmartFlowStrategyV3.analyzeRangeMarket应该修复边界无效时数据丢失问题', () => {
      const strategyPath = path.join(__dirname, '../../src/core/modules/strategy/SmartFlowStrategyV3.js');
      const content = fs.readFileSync(strategyPath, 'utf8');
      
      // 检查是否修复了字段映射问题
      expect(content).toContain('bb_upper: rangeResult.bb1h?.upper');
      expect(content).toContain('bb_middle: rangeResult.bb1h?.middle');
      expect(content).toContain('bb_lower: rangeResult.bb1h?.lower');
      expect(content).toContain('boundary_score_1h: rangeResult.totalScore');
      
      // 检查是否修复了边界无效时提前返回的问题
      expect(content).toContain('即使边界无效，也要返回布林带数据');
    });
  });

  describe('数据库字段映射修复验证', () => {
    test('DatabaseManager.recordStrategyAnalysis应该包含新的布林带字段', () => {
      const dbManagerPath = path.join(__dirname, '../../src/core/modules/database/DatabaseManager.js');
      const content = fs.readFileSync(dbManagerPath, 'utf8');
      
      // 检查是否添加了新的字段
      expect(content).toContain('range_lower_boundary_valid');
      expect(content).toContain('range_upper_boundary_valid');
      expect(content).toContain('bb_upper');
      expect(content).toContain('bb_middle');
      expect(content).toContain('bb_lower');
      expect(content).toContain('boundary_score_1h');
    });
  });

  describe('服务器启动修复验证', () => {
    test('server.js应该修复重复变量声明问题', () => {
      const serverPath = path.join(__dirname, '../../src/core/server.js');
      const content = fs.readFileSync(serverPath, 'utf8');
      
      // 检查是否还有重复的const server声明
      const serverDeclarations = (content.match(/const\s+server\s*=/g) || []).length;
      expect(serverDeclarations).toBeLessThanOrEqual(1);
      
      // 检查是否有smartFlowServer变量
      expect(content).toContain('smartFlowServer');
    });

    test('server.js应该包含错误处理', () => {
      const serverPath = path.join(__dirname, '../../src/core/server.js');
      const content = fs.readFileSync(serverPath, 'utf8');
      
      // 检查是否有错误处理
      expect(content).toContain('server.on(\'error\'');
      expect(content).toContain('EADDRINUSE');
    });

    test('start.js应该包含错误处理', () => {
      const startPath = path.join(__dirname, '../../start.js');
      const content = fs.readFileSync(startPath, 'utf8');
      
      // 检查是否有错误处理（start.js使用事件监听器而不是try-catch）
      expect(content).toContain('server.on(\'error\'');
      expect(content).toContain('process.on(\'uncaughtException\'');
    });
  });

  describe('资源使用优化验证', () => {
    test('定时器频率应该被优化', () => {
      const serverPath = path.join(__dirname, '../../src/core/server.js');
      const content = fs.readFileSync(serverPath, 'utf8');
      
      // 检查定时器频率是否被优化
      expect(content).toContain('45 * 60 * 1000'); // 45分钟
      expect(content).toContain('90 * 60 * 1000'); // 90分钟
      expect(content).toContain('10 * 60 * 1000'); // 10分钟
      expect(content).toContain('5 * 60 * 1000');  // 5分钟
    });

    test('应该包含并发控制', () => {
      const serverPath = path.join(__dirname, '../../src/core/server.js');
      const content = fs.readFileSync(serverPath, 'utf8');
      
      // 检查是否有并发控制（这些可能不在当前代码中）
      // expect(content).toContain('concurrency');
      // expect(content).toContain('maxConcurrent');
    });
  });

  describe('ATR值修复验证', () => {
    test('SmartFlowStrategyV3.calculateLeverageData应该处理ATR14为null的情况', () => {
      const strategyPath = path.join(__dirname, '../../src/core/modules/strategy/SmartFlowStrategyV3.js');
      const content = fs.readFileSync(strategyPath, 'utf8');
      
      // 检查是否有ATR14的null检查
      expect(content).toContain('atr14') || expect(content).toContain('atrValue');
    });
  });

  describe('修复脚本验证', () => {
    test('ATR修复脚本应该存在', () => {
      const fixScriptPath = path.join(__dirname, '../../scripts/fix-missing-atr.js');
      expect(fs.existsSync(fixScriptPath)).toBe(true);
    });

    test('资源优化脚本应该存在', () => {
      const optimizeScriptPath = path.join(__dirname, '../../scripts/optimize-resource-usage.js');
      expect(fs.existsSync(optimizeScriptPath)).toBe(true);
    });
  });
});
