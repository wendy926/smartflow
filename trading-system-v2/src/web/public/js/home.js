// 目标市场（用户选择的交易市场）
let targetMarket = 'crypto';

// 显示认证模态框
function showAuthModal(market) {
  // 检查是否已登录
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    // 已登录，直接跳转到对应市场的dashboard
    let redirectUrl = '/crypto/dashboard';
    if (market === 'a') redirectUrl = '/a/dashboard';
    if (market === 'us') redirectUrl = '/us/dashboard';
    
    window.location.href = redirectUrl;
    return;
  }
  
  // 未登录，显示登录框
  targetMarket = market;
  document.getElementById('authModal').classList.add('active');
}

// 关闭模态框
function closeModal(event) {
  if (event.target.classList.contains('modal-overlay')) {
    document.getElementById('authModal').classList.remove('active');
  }
}

// 发送验证码
async function sendVerificationCode() {
  const email = document.getElementById('email').value;
  const errorDiv = document.getElementById('authErrorMessage');
  const successDiv = document.getElementById('authSuccessMessage');
  const sendBtn = document.getElementById('sendCodeBtn');

  // 验证邮箱
  if (!email) {
    errorDiv.textContent = '请输入邮箱';
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorDiv.textContent = '邮箱格式不正确';
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
    return;
  }

  try {
    // 禁用按钮，开始倒计时
    sendBtn.disabled = true;
    let countdown = 60;

    const response = await fetch('/api/v1/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type: 'register' })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      successDiv.textContent = data.message || '验证码已发送';
      successDiv.style.display = 'block';
      errorDiv.style.display = 'none';

      // 倒计时
      const interval = setInterval(() => {
        sendBtn.textContent = `${countdown}秒后重试`;
        countdown--;
        if (countdown < 0) {
          clearInterval(interval);
          sendBtn.disabled = false;
          sendBtn.textContent = '发送验证码';
        }
      }, 1000);

      // 显示验证码输入框
      document.getElementById('codeInput').style.display = 'block';
      document.getElementById('verifyBtn').style.display = 'block';
    } else {
      errorDiv.textContent = data.message || '发送验证码失败';
      errorDiv.style.display = 'block';
      successDiv.style.display = 'none';
      sendBtn.disabled = false;
    }
  } catch (error) {
    errorDiv.textContent = '网络错误，请稍后重试';
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
    sendBtn.disabled = false;
  }
}

// 验证码登录/注册
async function verifyCode() {
  const email = document.getElementById('email').value;
  const code = document.getElementById('verificationCode').value;
  const errorDiv = document.getElementById('authErrorMessage');
  const successDiv = document.getElementById('authSuccessMessage');

  // 验证必填
  if (!email || !code) {
    errorDiv.textContent = '请输入邮箱和验证码';
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
    return;
  }

  try {
    const response = await fetch('/api/v1/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // 保存token
      localStorage.setItem('authToken', data.data.token);
      localStorage.setItem('userInfo', JSON.stringify(data.data.user));

      successDiv.textContent = '验证成功！正在跳转...';
      successDiv.style.display = 'block';
      errorDiv.style.display = 'none';

      // 根据选择的市场跳转
      let redirectUrl = '/crypto/dashboard';
      if (targetMarket === 'a') redirectUrl = '/a/dashboard';
      if (targetMarket === 'us') redirectUrl = '/us/dashboard';
      
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1500);
    } else {
      errorDiv.textContent = data.message || '验证失败';
      errorDiv.style.display = 'block';
      successDiv.style.display = 'none';
    }
  } catch (error) {
    errorDiv.textContent = '网络错误，请稍后重试';
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
  }
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userInfo');
  window.location.reload();
}

// 事件监听器
document.addEventListener('DOMContentLoaded', function() {
  // 所有"进入交易系统"按钮
  document.querySelectorAll('button[data-market]').forEach(btn => {
    btn.addEventListener('click', function() {
      const market = this.getAttribute('data-market');
      showAuthModal(market);
    });
  });

  // 发送验证码按钮
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      sendVerificationCode();
    });
  }

  // 验证按钮
  const verifyBtn = document.getElementById('verifyBtn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', function(e) {
      e.preventDefault();
      verifyCode();
    });
  }

  // 模态框关闭
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.addEventListener('click', function(e) {
      closeModal(e);
    });
  }

  // 检查是否已登录
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    document.querySelector('.nav-actions').innerHTML = `
      <span style="margin-right: 15px;">欢迎，${userInfo.email}</span>
      <button class="btn-login" id="logoutBtn">退出</button>
    `;
    
    document.getElementById('logoutBtn').addEventListener('click', function() {
      logout();
    });
  }

  // 加载系统监控数据
  loadMonitoringData();

  // 加载用户统计数据
  loadUserStats();
});

// 加载系统监控数据
async function loadMonitoringData() {
  try {
    const response = await fetch('/api/v1/monitoring/status');
    const data = await response.json();
    
    if (data.success) {
      const vps = data.data.vps || {};
      const ai = data.data.ai || {};
      const services = data.data.services || {};
      
      // 获取健康状态的颜色和文本
      const getStatusColor = (status) => {
        switch (status) {
          case 'healthy': return 'green';
          case 'warning': return 'orange';
          case 'unhealthy':
          case 'disconnected': return 'red';
          default: return 'gray';
        }
      };
      
      const getStatusText = (status) => {
        switch (status) {
          case 'healthy': return '健康';
          case 'warning': return '警告';
          case 'unhealthy': return '异常';
          case 'disconnected': return '断开';
          default: return '未知';
        }
      };

      const content = `
        <div style="text-align: left; line-height: 1.8;">
          <h4 style="color: #667eea; margin-bottom: 10px;">📊 VPS资源使用</h4>
          <p><strong>CPU使用率：</strong> ${vps.cpu || 'N/A'}%</p>
          <p><strong>内存使用率：</strong> ${vps.memory || 'N/A'}%</p>
          <p><strong>磁盘使用率：</strong> ${vps.disk || 'N/A'}%</p>
          
          <h4 style="color: #667eea; margin: 20px 0 10px 0;">🤖 AI分析统计（24小时）</h4>
          <p><strong>总调用次数：</strong> ${ai.totalCalls || 0}</p>
          <p><strong>成功次数：</strong> ${ai.successCalls || 0}</p>
          <p><strong>成功率：</strong> ${ai.successRate || 0}%</p>
          
          <h4 style="color: #667eea; margin: 20px 0 10px 0;">🔧 服务健康状态</h4>
          <p><strong>数据库：</strong> <span style="color: ${getStatusColor(services.database)};">${getStatusText(services.database)}</span></p>
          <p><strong>Redis：</strong> <span style="color: ${getStatusColor(services.redis)};">${getStatusText(services.redis)}</span></p>
        </div>
      `;
      document.getElementById('monitoringContent').innerHTML = content;
    } else {
      document.getElementById('monitoringContent').innerHTML = '<p style="color: #999;">暂无监控数据</p>';
    }
  } catch (error) {
    console.error('加载监控数据失败:', error);
    document.getElementById('monitoringContent').innerHTML = '<p style="color: #999;">无法加载监控数据</p>';
  }
}

// 加载用户统计数据
async function loadUserStats() {
  try {
    const response = await fetch('/api/v1/users/stats');
    const data = await response.json();
    
    if (data.success) {
      const content = `
        <div style="text-align: left; line-height: 1.8;">
          <p><strong>总用户数：</strong> ${data.data.totalUsers || 0}</p>
          <p><strong>今日新增用户：</strong> ${data.data.todayNewUsers || 0}</p>
          <p><strong>活跃用户数：</strong> ${data.data.activeUsers || 0}</p>
        </div>
      `;
      document.getElementById('userStatsContent').innerHTML = content;
    } else {
      document.getElementById('userStatsContent').innerHTML = '<p style="color: #999;">暂无用户数据</p>';
    }
  } catch (error) {
    console.error('加载用户数据失败:', error);
    document.getElementById('userStatsContent').innerHTML = '<p style="color: #999;">无法加载用户数据</p>';
  }
}
