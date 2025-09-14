/**
 * 数据清空脚本的单元测试
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

describe('数据清空脚本测试', () => {
  const scriptPath = path.join(__dirname, '../scripts/clear-all-data.js');
  
  beforeAll(() => {
    // 确保脚本文件存在
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  test('脚本文件存在且可执行', () => {
    const stats = fs.statSync(scriptPath);
    expect(stats.isFile()).toBe(true);
    
    // 检查文件权限（在Unix系统上）
    if (process.platform !== 'win32') {
      const mode = stats.mode;
      const isExecutable = (mode & parseInt('111', 8)) !== 0;
      expect(isExecutable).toBe(true);
    }
  });

  test('脚本语法正确', () => {
    // 检查脚本语法是否正确
    expect(() => {
      require(scriptPath);
    }).not.toThrow();
  });

  test('脚本包含必要的表名', () => {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    const expectedTables = [
      'simulations',
      'win_rate_stats',
      'strategy_v3_analysis',
      'analysis_logs',
      'data_quality_issues',
      'validation_results'
    ];
    
    expectedTables.forEach(table => {
      expect(scriptContent).toContain(table);
    });
  });

  test('脚本包含VACUUM优化', () => {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    expect(scriptContent).toContain('VACUUM');
  });

  test('脚本包含默认win_rate_stats插入', () => {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    expect(scriptContent).toContain('INSERT INTO win_rate_stats');
    expect(scriptContent).toContain('total_trades, winning_trades, losing_trades, win_rate');
  });
});
