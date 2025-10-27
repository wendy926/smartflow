// 目标市场（用户选择的交易市场）
let targetMarket = 'crypto';

// 显示认证模态框
function showAuthModal(market) {
  // 检查是否为CN VPS域名（smart.aimaven.top）
  const isCNVPS = window.location.hostname === 'smart.aimaven.top';
  
  // 如果是CN VPS，且选择的是加密货币或美股市场，则重定向到SG VPS
  if (isCNVPS && (market === 'crypto' || market === 'us')) {
    // 显示提示信息
    const marketName = market === 'crypto' ? '加密货币' : '美股';
    alert(`${marketName}交易功能受地域限制，正在跳转到国际服务器...`);
    
    // 获取用户的登录状态
    const authToken = localStorage.getItem('authToken');
    const userEmail = localStorage.getItem('userEmail');
    
    // 构建重定向URL
    let redirectUrl = 'https://smart.aimaventop.com/';
    
    // 如果用户已登录，重定向到对应的dashboard并传递token
    if (authToken) {
      if (market === 'crypto') {
        redirectUrl = 'https://smart.aimaventop.com/crypto/dashboard';
      } else if (market === 'us') {
        redirectUrl = 'https://smart.aimaventop.com/us/dashboard';
      }
      // 设置token以便SG VPS识别用户
      redirectUrl += `?token=${encodeURIComponent(authToken)}`;
    }
    
    // 重定向
    window.location.href = redirectUrl;
    return;
  }
  
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
document.addEventListener('DOMContentLoaded', function () {
  // 所有"进入交易系统"按钮
  document.querySelectorAll('button[data-market]').forEach(btn => {
    btn.addEventListener('click', function () {
      const market = this.getAttribute('data-market');
      showAuthModal(market);
    });
  });

  // 发送验证码按钮
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      sendVerificationCode();
    });
  }

  // 验证按钮
  const verifyBtn = document.getElementById('verifyBtn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', function (e) {
      e.preventDefault();
      verifyCode();
    });
  }

  // 模态框关闭
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.addEventListener('click', function (e) {
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

    document.getElementById('logoutBtn').addEventListener('click', function () {
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
        <div style="text-align: left; line-height: 2;">
          <div style="margin-bottom: 20px;">
            <p style="color: #666; font-size: 14px; margin-bottom: 8px;">CPU使用率</p>
            <span style="font-size: 20px; font-weight: bold; color: ${parseFloat(vps.cpu) > 70 ? '#ff6b6b' : '#4caf50'};">${vps.cpu}%</span>
          </div>
          <div style="margin-bottom: 20px;">
            <p style="color: #666; font-size: 14px; margin-bottom: 8px;">内存使用率</p>
            <span style="font-size: 20px; font-weight: bold; color: ${parseFloat(vps.memory) > 70 ? '#ff6b6b' : '#4caf50'};">${vps.memory}%</span>
          </div>
          <div style="margin-bottom: 20px;">
            <p style="color: #666; font-size: 14px; margin-bottom: 8px;">AI调用成功率</p>
            <span style="font-size: 20px; font-weight: bold; color: #667eea;">${ai.successRate}%</span>
            <p style="color: #999; font-size: 12px; margin-top: 5px;">${ai.totalCalls}次调用 / 成功${ai.successCalls}次</p>
          </div>
          <div style="display: flex; gap: 15px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
            <div>
              <p style="color: #666; font-size: 12px; margin-bottom: 5px;">数据库</p>
              <span style="color: ${getStatusColor(services.database)}; font-weight: bold;">${getStatusText(services.database)}</span>
            </div>
            <div>
              <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Redis</p>
              <span style="color: ${getStatusColor(services.redis)}; font-weight: bold;">${getStatusText(services.redis)}</span>
            </div>
          </div>
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
        <div style="text-align: left; line-height: 2;">
          <div style="margin-bottom: 15px;">
            <span style="font-size: 24px; font-weight: bold; color: #667eea;">${data.data.totalUsers || 0}</span>
            <p style="color: #666; margin-top: 5px; font-size: 14px;">总用户数</p>
          </div>
          <div style="margin-bottom: 15px;">
            <span style="font-size: 24px; font-weight: bold; color: #f7931a;">${data.data.todayNewUsers || 0}</span>
            <p style="color: #666; margin-top: 5px; font-size: 14px;">今日新增</p>
          </div>
          <div style="margin-bottom: 15px;">
            <span style="font-size: 24px; font-weight: bold; color: #4caf50;">${data.data.activeUsers || 0}</span>
            <p style="color: #666; margin-top: 5px; font-size: 14px;">活跃用户（7天）</p>
          </div>
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
