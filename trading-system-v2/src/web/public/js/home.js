// 目标市场（用户选择的交易市场）
let targetMarket = 'crypto';

// 显示认证模态框
function showAuthModal(market) {
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
});
