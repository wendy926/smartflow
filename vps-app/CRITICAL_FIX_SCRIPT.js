#!/usr/bin/env node

/**
 * VPS关键问题修复脚本
 * 解决死循环和LDOUSDT数据问题
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 开始修复VPS关键问题...');

// 1. 修复server.js中的定时器配置
function fixServerTimers() {
    console.log('🔧 修复server.js定时器配置...');
    
    const serverPath = './server.js';
    if (!fs.existsSync(serverPath)) {
        console.error('❌ server.js文件不存在');
        return false;
    }
    
    let content = fs.readFileSync(serverPath, 'utf8');
    
    // 修复定时器间隔 - 将所有短间隔改为合理间隔
    const fixes = [
        // 将5分钟间隔改为30分钟
        { from: /5 \* 60 \* 1000/g, to: '30 * 60 * 1000' },
        // 将2分钟间隔改为30分钟  
        { from: /2 \* 60 \* 1000/g, to: '30 * 60 * 1000' },
        // 更新注释
        { from: /\/\/ 5分钟/g, to: '// 30分钟' },
        { from: /\/\/ 2分钟/g, to: '// 30分钟' },
        { from: /\/\/ 15分钟/g, to: '// 30分钟' }
    ];
    
    fixes.forEach(fix => {
        content = content.replace(fix.from, fix.to);
    });
    
    // 添加定时器状态管理
    const timerManagerCode = `
    // 定时器状态管理
    this.timerStates = new Map();
    
    startManagedTimer(name, callback, interval) {
        // 防止重复启动
        if (this.timerStates.get(name)) {
            console.log(\`⏰ 定时器 \${name} 已在运行，跳过启动\`);
            return;
        }
        
        const timer = setInterval(callback, interval);
        this.timerStates.set(name, { timer, interval, lastRun: Date.now() });
        console.log(\`✅ 启动定时器: \${name} (间隔: \${interval/1000}秒)\`);
        return timer;
    }
    
    stopManagedTimer(name) {
        const state = this.timerStates.get(name);
        if (state) {
            clearInterval(state.timer);
            this.timerStates.delete(name);
            console.log(\`🛑 停止定时器: \${name}\`);
        }
    }
    
    stopAllManagedTimers() {
        this.timerStates.forEach((state, name) => {
            clearInterval(state.timer);
            console.log(\`🛑 停止定时器: \${name}\`);
        });
        this.timerStates.clear();
    }
`;
    
    // 在类定义后添加定时器管理方法
    content = content.replace(
        /class SmartFlowServer {[\s\S]*?constructor\(\) {/,
        (match) => match + timerManagerCode
    );
    
    // 备份原文件
    fs.writeFileSync(serverPath + '.backup.' + Date.now(), fs.readFileSync(serverPath));
    
    // 写入修复后的内容
    fs.writeFileSync(serverPath, content);
    
    console.log('✅ server.js定时器配置修复完成');
    return true;
}

// 2. 修复LDOUSDT数据问题
function fixLDOUSDTData() {
    console.log('🔧 修复LDOUSDT数据问题...');
    
    const strategyPath = './modules/strategy/StrategyV3Core.js';
    if (!fs.existsSync(strategyPath)) {
        console.error('❌ StrategyV3Core.js文件不存在');
        return false;
    }
    
    let content = fs.readFileSync(strategyPath, 'utf8');
    
    // 修复calculateMA方法，添加数据验证
    const calculateMAFix = `
    calculateMA(klines, period) {
        if (!klines || klines.length === 0) {
            console.warn('⚠️ K线数据为空，无法计算MA');
            return [];
        }
        
        // 数据清理和验证
        const validKlines = klines.filter(kline => {
            if (!kline || !Array.isArray(kline) || kline.length < 6) {
                return false;
            }
            
            const close = parseFloat(kline[4]);
            const volume = parseFloat(kline[5]);
            
            return !isNaN(close) && close > 0 && !isNaN(volume) && volume >= 0;
        });
        
        if (validKlines.length < period) {
            console.warn(\`⚠️ 有效数据不足: \${validKlines.length}/\${period}\`);
            return [];
        }
        
        console.log(\`📊 使用 \${validKlines.length} 条有效数据进行MA\${period}计算\`);
        
        const ma = [];
        for (let i = period - 1; i < validKlines.length; i++) {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sum += parseFloat(validKlines[j][4]);
            }
            const avg = sum / period;
            ma.push(avg);
        }
        
        return ma;
    }`;
    
    // 替换calculateMA方法
    content = content.replace(
        /calculateMA\(klines, period\) \{[\s\S]*?\}/,
        calculateMAFix
    );
    
    // 添加数据验证方法
    const dataValidationCode = `
    validateKlineData(klines, symbol) {
        if (!klines || klines.length === 0) {
            console.warn(\`⚠️ [\${symbol}] K线数据为空\`);
            return false;
        }
        
        const invalidCount = klines.filter(kline => {
            if (!kline || !Array.isArray(kline) || kline.length < 6) {
                return true;
            }
            
            const close = parseFloat(kline[4]);
            const volume = parseFloat(kline[5]);
            
            return isNaN(close) || close <= 0 || isNaN(volume) || volume < 0;
        }).length;
        
        if (invalidCount > 0) {
            console.warn(\`⚠️ [\${symbol}] 发现 \${invalidCount} 条无效数据\`);
        }
        
        const validCount = klines.length - invalidCount;
        console.log(\`📊 [\${symbol}] 数据验证完成: \${validCount}/\${klines.length} 条有效\`);
        
        return validCount > 0;
    }`;
    
    // 在类中添加数据验证方法
    content = content.replace(
        /class StrategyV3Core {[\s\S]*?constructor\(db\) {/,
        (match) => match + dataValidationCode
    );
    
    // 备份原文件
    fs.writeFileSync(strategyPath + '.backup.' + Date.now(), fs.readFileSync(strategyPath));
    
    // 写入修复后的内容
    fs.writeFileSync(strategyPath, content);
    
    console.log('✅ LDOUSDT数据问题修复完成');
    return true;
}

// 3. 创建监控脚本
function createMonitorScript() {
    console.log('🔧 创建监控脚本...');
    
    const monitorScript = `#!/usr/bin/env node

/**
 * VPS性能监控脚本
 */

const { exec } = require('child_process');

function checkSystemHealth() {
    console.log('\\n📊 系统健康检查 -', new Date().toLocaleString());
    
    // 检查CPU使用率
    exec('top -b -n 1 | head -15', (error, stdout) => {
        if (error) {
            console.error('❌ CPU检查失败:', error);
            return;
        }
        
        const lines = stdout.split('\\n');
        const cpuLine = lines.find(line => line.includes('%Cpu'));
        const processLines = lines.filter(line => line.includes('node'));
        
        console.log('🖥️  CPU状态:', cpuLine);
        console.log('🔄 Node进程:', processLines.length > 0 ? processLines[0] : '未找到');
        
        // 检查是否有高CPU使用率的进程
        const highCpuProcesses = processLines.filter(line => {
            const cpuMatch = line.match(/(\\d+\\.\\d+)%/);
            return cpuMatch && parseFloat(cpuMatch[1]) > 10;
        });
        
        if (highCpuProcesses.length > 0) {
            console.log('⚠️  发现高CPU使用率进程:');
            highCpuProcesses.forEach(proc => console.log('   ', proc.trim()));
        } else {
            console.log('✅ CPU使用率正常');
        }
    });
    
    // 检查内存使用
    exec('free -h', (error, stdout) => {
        if (error) {
            console.error('❌ 内存检查失败:', error);
            return;
        }
        
        console.log('💾 内存状态:');
        console.log(stdout);
    });
}

// 每30秒检查一次
setInterval(checkSystemHealth, 30000);
checkSystemHealth();

console.log('🚀 性能监控已启动，每30秒检查一次系统状态');
`;

    fs.writeFileSync('./monitor-performance.js', monitorScript);
    fs.chmodSync('./monitor-performance.js', '755');
    
    console.log('✅ 监控脚本创建完成: monitor-performance.js');
    return true;
}

// 执行修复
async function main() {
    try {
        console.log('🎯 开始执行修复任务...\n');
        
        const results = [
            fixServerTimers(),
            fixLDOUSDTData(),
            createMonitorScript()
        ];
        
        const successCount = results.filter(Boolean).length;
        
        console.log(`\\n📋 修复完成: ${successCount}/${results.length} 项成功`);
        
        if (successCount === results.length) {
            console.log('🎉 所有修复任务完成！');
            console.log('\\n📝 下一步操作:');
            console.log('1. 重启PM2服务: pm2 restart smartflow-app');
            console.log('2. 监控系统状态: node monitor-performance.js');
            console.log('3. 检查LDOUSDT数据: 等待下一次数据更新');
        } else {
            console.log('⚠️  部分修复失败，请检查错误信息');
        }
        
    } catch (error) {
        console.error('❌ 修复过程中发生错误:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = { fixServerTimers, fixLDOUSDTData, createMonitorScript };
