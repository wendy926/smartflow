// fix-database-connection.js
// 修复server.js中SmartFlowStrategyV3.analyzeSymbol调用缺少database参数的问题

const fs = require('fs');
const path = require('path');

class DatabaseConnectionFixer {
  constructor() {
    this.serverPath = 'server.js';
  }

  async fix() {
    try {
      console.log('🔧 修复server.js中数据库连接问题...');

      // 读取server.js文件
      const serverContent = fs.readFileSync(this.serverPath, 'utf8');

      // 定义需要修复的模式
      const patterns = [
        {
          // 模式1：缺少database参数的情况
          search: /const analysis = await SmartFlowStrategyV3\.analyzeSymbol\(symbol, \{\s*maxLossAmount: parseFloat\(maxLossAmount\),\s*dataRefreshManager: this\.dataRefreshManager\s*\}\);/g,
          replace: `const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });`
        },
        {
          // 模式2：另一个缺少database参数的情况
          search: /const analysis = await SmartFlowStrategyV3\.analyzeSymbol\(symbol, \{\s*database: this\.db,\s*maxLossAmount: parseFloat\(maxLossAmount\),\s*dataRefreshManager: this\.dataRefreshManager\s*\}\);/g,
          replace: `const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, {
        database: this.db,
        maxLossAmount: parseFloat(maxLossAmount),
        dataRefreshManager: this.dataRefreshManager
      });`
        }
      ];

      let fixedContent = serverContent;
      let totalFixes = 0;

      // 应用修复
      for (const pattern of patterns) {
        const matches = fixedContent.match(pattern.search);
        if (matches) {
          console.log(`🔍 找到 ${matches.length} 个匹配的模式`);
          fixedContent = fixedContent.replace(pattern.search, pattern.replace);
          totalFixes += matches.length;
        }
      }

      if (totalFixes > 0) {
        // 备份原文件
        const backupPath = `${this.serverPath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, serverContent);
        console.log(`📦 原文件已备份到: ${backupPath}`);

        // 写入修复后的内容
        fs.writeFileSync(this.serverPath, fixedContent);
        console.log(`✅ 修复完成，共修复 ${totalFixes} 处数据库连接问题`);
      } else {
        console.log('ℹ️ 没有找到需要修复的地方');
      }

      // 验证修复结果
      const verificationContent = fs.readFileSync(this.serverPath, 'utf8');
      const missingDbCalls = verificationContent.match(/SmartFlowStrategyV3\.analyzeSymbol\([^)]*\{[^}]*maxLossAmount[^}]*dataRefreshManager[^}]*\}/g);
      
      if (missingDbCalls) {
        console.log('⚠️ 警告：仍有一些调用可能缺少database参数:');
        missingDbCalls.forEach((call, index) => {
          console.log(`  ${index + 1}. ${call.substring(0, 100)}...`);
        });
      } else {
        console.log('✅ 验证通过：所有SmartFlowStrategyV3.analyzeSymbol调用都已包含database参数');
      }

    } catch (error) {
      console.error('❌ 修复失败:', error);
      throw error;
    }
  }

  /**
   * 验证修复结果
   */
  verify() {
    try {
      const serverContent = fs.readFileSync(this.serverPath, 'utf8');
      
      // 统计SmartFlowStrategyV3.analyzeSymbol调用
      const allCalls = serverContent.match(/SmartFlowStrategyV3\.analyzeSymbol\(/g);
      const callsWithDb = serverContent.match(/SmartFlowStrategyV3\.analyzeSymbol\([^)]*database: this\.db/g);
      
      console.log(`📊 验证结果:`);
      console.log(`  总调用次数: ${allCalls ? allCalls.length : 0}`);
      console.log(`  包含database参数的调用: ${callsWithDb ? callsWithDb.length : 0}`);
      
      if (allCalls && callsWithDb && allCalls.length === callsWithDb.length) {
        console.log('✅ 所有调用都包含database参数');
        return true;
      } else {
        console.log('❌ 仍有调用缺少database参数');
        return false;
      }
    } catch (error) {
      console.error('❌ 验证失败:', error);
      return false;
    }
  }
}

// 主函数
async function main() {
  const fixer = new DatabaseConnectionFixer();
  
  try {
    await fixer.fix();
    fixer.verify();
    console.log('🎉 数据库连接修复完成！');
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  }
}

// 运行修复脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabaseConnectionFixer;
