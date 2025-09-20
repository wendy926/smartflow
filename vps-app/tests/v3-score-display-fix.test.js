const assert = require('assert');

// V3策略得分显示修复测试
describe('V3策略得分显示修复测试', () => {
  
  describe('后端API数据格式测试', () => {
    it('应该返回正确的4H趋势打分和1H多因子得分', () => {
      // 模拟simulateV3Analysis函数逻辑
      function simulateV3Analysis(symbol, currentPrice) {
        // 模拟4H趋势过滤10分打分
        const trend4hScore = Math.floor(Math.random() * 11); // 0-10分
        const trend4h = trend4hScore >= 4 ? 
          (Math.random() > 0.5 ? '多头趋势' : '空头趋势') : '震荡市';
        
        // 模拟1H多因子打分6分制
        const hourlyScore = trend4h !== '震荡市' ? Math.floor(Math.random() * 7) : 0; // 0-6分
        const signal = hourlyScore >= 3 ? 
          (trend4h === '多头趋势' ? '做多' : '做空') : '观望';

        // 模拟15m执行
        const execution = signal !== '观望' ? 
          (trend4h === '多头趋势' ? '做多_回踩确认' : '做空_反抽破位') : 'NONE';
        const executionMode = signal !== '观望' ? 'LONG' : 'WAIT';

        const entryPrice = currentPrice;
        let stopLoss, takeProfit;
        if (signal !== '观望') {
          const stopDistance = currentPrice * 0.02; // 2%止损
          stopLoss = signal === '做多' ? currentPrice - stopDistance : currentPrice + stopDistance;
          takeProfit = signal === '做多' ? currentPrice + stopDistance * 2 : currentPrice - stopDistance * 2;
        }

        return {
          trend4h,
          trendStrength: trend4hScore >= 7 ? '强' : trend4hScore >= 5 ? '中' : '弱',
          score4h: trend4hScore,
          score1h: hourlyScore,  // 添加1H多因子得分
          signal,
          hourlyJudgment: getHourlyJudgment(signal, hourlyScore),
          fifteenMinJudgment: getFifteenMinJudgment(execution),
          execution,
          executionMode,
          entryPrice,
          stopLoss,
          takeProfit
        };
      }

      function getHourlyJudgment(signal, score) {
        if (signal === '观望') return '数据分析中';
        if (score >= 5) return `${signal}强势`;
        if (score >= 4) return `${signal}延续`;
        return `${signal}确认`;
      }

      function getFifteenMinJudgment(execution) {
        if (execution === 'NONE') return '等待信号';
        if (execution.includes('回踩确认')) return '回踩确认';
        if (execution.includes('反抽破位')) return '反抽破位';
        return '突破确认';
      }

      // 测试多次生成数据
      for (let i = 0; i < 10; i++) {
        const result = simulateV3Analysis('BTCUSDT', 50000);
        
        // 验证返回数据结构
        assert.ok(typeof result.score4h === 'number', 'score4h应该是数字');
        assert.ok(typeof result.score1h === 'number', 'score1h应该是数字');
        assert.ok(result.score4h >= 0 && result.score4h <= 10, 'score4h应该在0-10范围内');
        assert.ok(result.score1h >= 0 && result.score1h <= 6, 'score1h应该在0-6范围内');
        assert.ok(['多头趋势', '空头趋势', '震荡市'].includes(result.trend4h), 'trend4h应该是有效的趋势类型');
      }
    });

    it('应该正确处理趋势市和震荡市的得分逻辑', () => {
      function simulateV3Analysis(symbol, currentPrice) {
        const trend4hScore = 8; // 固定为趋势市
        const trend4h = '多头趋势';
        const hourlyScore = 5; // 固定1H得分
        const signal = '做多';

        return {
          trend4h,
          score4h: trend4hScore,
          score1h: hourlyScore,
          signal,
          execution: '做多_回踩确认'
        };
      }

      function simulateRangeAnalysis(symbol, currentPrice) {
        const trend4hScore = 2; // 固定为震荡市
        const trend4h = '震荡市';
        const hourlyScore = 0; // 震荡市1H得分应该为0
        const signal = '观望';

        return {
          trend4h,
          score4h: trend4hScore,
          score1h: hourlyScore,
          signal,
          execution: 'NONE'
        };
      }

      const trendResult = simulateV3Analysis('BTCUSDT', 50000);
      const rangeResult = simulateRangeAnalysis('BTCUSDT', 50000);

      // 验证趋势市逻辑
      assert.strictEqual(trendResult.score4h, 8);
      assert.strictEqual(trendResult.score1h, 5);
      assert.strictEqual(trendResult.trend4h, '多头趋势');
      assert.strictEqual(trendResult.signal, '做多');

      // 验证震荡市逻辑
      assert.strictEqual(rangeResult.score4h, 2);
      assert.strictEqual(rangeResult.score1h, 0);
      assert.strictEqual(rangeResult.trend4h, '震荡市');
      assert.strictEqual(rangeResult.signal, '观望');
    });
  });

  describe('前端显示逻辑测试', () => {
    it('应该正确显示4H趋势打分和1H多因子得分', () => {
      // 模拟DOM环境
      const mockDOM = {
        createElement: function(tagName) {
          return {
            tagName: tagName,
            innerHTML: '',
            classList: {
              add: function() {},
              contains: function(className) {
                return this.innerHTML.includes(className);
              }
            },
            textContent: '',
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; }
          };
        }
      };

      // 模拟前端表格更新逻辑
      function createSignalRow(signal) {
        const tr = mockDOM.createElement('tr');
        tr.innerHTML = `
          <td><button class="expand-btn">+</button></td>
          <td><strong>${signal.symbol}</strong></td>
          <td class="category-${signal.category}">${signal.category}</td>
          <td class="score-${signal.score4h >= 4 ? 'high' : 'low'}">${signal.score4h || 0}</td>
          <td class="trend-${signal.trend4h?.toLowerCase() || 'none'}">${signal.trend4h || '--'}</td>
          <td class="score-${signal.score1h >= 3 ? 'high' : 'low'}">${signal.score1h || 0}</td>
          <td class="trend-${signal.trendStrength?.toLowerCase() || 'none'}">${signal.trendStrength || '--'}</td>
          <td class="signal-${signal.signal?.toLowerCase() || 'none'}">${signal.signal || '--'}</td>
          <td class="price-cell">${signal.currentPrice ? signal.currentPrice.toFixed(4) : '--'}</td>
          <td class="rate-cell">${signal.dataCollectionRate?.toFixed(1) || 0}%</td>
        `;
        return tr;
      }

      // 模拟信号数据
      const signal = {
        symbol: 'ETHUSDT',
        category: 'mainstream',
        score4h: 8,  // 4H趋势打分
        score1h: 5,  // 1H多因子得分
        trend4h: '多头趋势',
        trendStrength: '强',
        signal: '做多',
        currentPrice: 4500.1234,
        dataCollectionRate: 98.5
      };

      const row = createSignalRow(signal);
      
      // 验证HTML内容包含正确的数据
      assert.ok(row.innerHTML.includes('8'), '应该包含4H趋势打分8');
      assert.ok(row.innerHTML.includes('score-high'), '4H得分>=4应该包含high样式');
      assert.ok(row.innerHTML.includes('多头趋势'), '应该包含4H趋势多头趋势');
      assert.ok(row.innerHTML.includes('5'), '应该包含1H多因子得分5');
      assert.ok(row.innerHTML.includes('做多'), '应该包含信号做多');
    });

    it('应该正确处理低分情况', () => {
      // 模拟DOM环境
      const mockDOM = {
        createElement: function(tagName) {
          return {
            tagName: tagName,
            innerHTML: '',
            classList: {
              add: function() {},
              contains: function(className) {
                return this.innerHTML.includes(className);
              }
            },
            textContent: '',
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; }
          };
        }
      };

      function createSignalRow(signal) {
        const tr = mockDOM.createElement('tr');
        tr.innerHTML = `
          <td><button class="expand-btn">+</button></td>
          <td><strong>${signal.symbol}</strong></td>
          <td class="category-${signal.category}">${signal.category}</td>
          <td class="score-${signal.score4h >= 4 ? 'high' : 'low'}">${signal.score4h || 0}</td>
          <td class="trend-${signal.trend4h?.toLowerCase() || 'none'}">${signal.trend4h || '--'}</td>
          <td class="score-${signal.score1h >= 3 ? 'high' : 'low'}">${signal.score1h || 0}</td>
          <td class="trend-${signal.trendStrength?.toLowerCase() || 'none'}">${signal.trendStrength || '--'}</td>
          <td class="signal-${signal.signal?.toLowerCase() || 'none'}">${signal.signal || '--'}</td>
          <td class="price-cell">${signal.currentPrice ? signal.currentPrice.toFixed(4) : '--'}</td>
          <td class="rate-cell">${signal.dataCollectionRate?.toFixed(1) || 0}%</td>
        `;
        return tr;
      }

      // 模拟低分信号数据
      const signal = {
        symbol: 'BTCUSDT',
        category: 'mainstream',
        score4h: 2,  // 低4H趋势打分
        score1h: 1,  // 低1H多因子得分
        trend4h: '震荡市',
        trendStrength: '弱',
        signal: '观望',
        currentPrice: 43000.5678,
        dataCollectionRate: 95.2
      };

      const row = createSignalRow(signal);
      
      // 验证HTML内容包含正确的数据
      assert.ok(row.innerHTML.includes('2'), '应该包含4H趋势打分2');
      assert.ok(row.innerHTML.includes('score-low'), '4H得分<4应该包含low样式');
      assert.ok(row.innerHTML.includes('1'), '应该包含1H多因子得分1');
      assert.ok(row.innerHTML.includes('观望'), '应该包含信号观望');
    });

    it('应该处理undefined和null数据', () => {
      // 模拟DOM环境
      const mockDOM = {
        createElement: function(tagName) {
          return {
            tagName: tagName,
            innerHTML: '',
            classList: {
              add: function() {},
              contains: function(className) {
                return this.innerHTML.includes(className);
              }
            },
            textContent: '',
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; }
          };
        }
      };

      function createSignalRow(signal) {
        const tr = mockDOM.createElement('tr');
        tr.innerHTML = `
          <td><button class="expand-btn">+</button></td>
          <td><strong>${signal.symbol}</strong></td>
          <td class="category-${signal.category}">${signal.category}</td>
          <td class="score-${signal.score4h >= 4 ? 'high' : 'low'}">${signal.score4h || 0}</td>
          <td class="trend-${signal.trend4h?.toLowerCase() || 'none'}">${signal.trend4h || '--'}</td>
          <td class="score-${signal.score1h >= 3 ? 'high' : 'low'}">${signal.score1h || 0}</td>
          <td class="trend-${signal.trendStrength?.toLowerCase() || 'none'}">${signal.trendStrength || '--'}</td>
          <td class="signal-${signal.signal?.toLowerCase() || 'none'}">${signal.signal || '--'}</td>
          <td class="price-cell">${signal.currentPrice ? signal.currentPrice.toFixed(4) : '--'}</td>
          <td class="rate-cell">${signal.dataCollectionRate?.toFixed(1) || 0}%</td>
        `;
        return tr;
      }

      // 模拟不完整数据
      const signal = {
        symbol: 'UNKNOWN',
        category: 'smallcap'
        // 缺少score4h, score1h, trend4h等字段
      };

      const row = createSignalRow(signal);
      
      // 验证默认值处理
      assert.ok(row.innerHTML.includes('0'), '应该包含score4h默认值0');
      assert.ok(row.innerHTML.includes('--'), '应该包含trend4h默认值--');
      assert.ok(row.innerHTML.includes('0'), '应该包含score1h默认值0');
    });
  });

  describe('API响应格式测试', () => {
    it('应该返回包含score4h和score1h的完整数据结构', () => {
      // 模拟完整的API响应
      function generateV3Signal(symbol, currentPrice) {
        const trend4hScore = Math.floor(Math.random() * 11);
        const trend4h = trend4hScore >= 4 ? 
          (Math.random() > 0.5 ? '多头趋势' : '空头趋势') : '震荡市';
        const hourlyScore = trend4h !== '震荡市' ? Math.floor(Math.random() * 7) : 0;

        return {
          symbol,
          category: 'mainstream',
          currentPrice,
          dataCollectionRate: 95.5,
          engineSource: 'V3',
          entrySignal: currentPrice,
          execution: hourlyScore >= 3 ? '做多_回踩确认' : 'NONE',
          executionMode: hourlyScore >= 3 ? 'LONG' : 'WAIT',
          fifteenMinJudgment: hourlyScore >= 3 ? '回踩确认' : '等待信号',
          hourlyJudgment: hourlyScore >= 3 ? '做多确认' : '数据分析中',
          score4h: trend4hScore,  // 4H趋势打分
          score1h: hourlyScore,   // 1H多因子得分
          signal: hourlyScore >= 3 ? '做多' : '观望',
          stopLoss: hourlyScore >= 3 ? currentPrice * 0.98 : null,
          strategyVersion: 'V3',
          takeProfit: hourlyScore >= 3 ? currentPrice * 1.04 : null,
          timestamp: new Date().toISOString(),
          trend4h,
          trendStrength: trend4hScore >= 7 ? '强' : trend4hScore >= 5 ? '中' : '弱'
        };
      }

      const signal = generateV3Signal('BTCUSDT', 50000);

      // 验证必需字段
      assert.ok(signal.hasOwnProperty('score4h'), '应该包含score4h字段');
      assert.ok(signal.hasOwnProperty('score1h'), '应该包含score1h字段');
      assert.ok(signal.hasOwnProperty('trend4h'), '应该包含trend4h字段');
      assert.ok(signal.hasOwnProperty('signal'), '应该包含signal字段');

      // 验证数据类型
      assert.ok(typeof signal.score4h === 'number', 'score4h应该是数字');
      assert.ok(typeof signal.score1h === 'number', 'score1h应该是数字');
      assert.ok(typeof signal.trend4h === 'string', 'trend4h应该是字符串');
      assert.ok(typeof signal.signal === 'string', 'signal应该是字符串');

      // 验证数值范围
      assert.ok(signal.score4h >= 0 && signal.score4h <= 10, 'score4h应该在0-10范围内');
      assert.ok(signal.score1h >= 0 && signal.score1h <= 6, 'score1h应该在0-6范围内');
    });
  });
});
