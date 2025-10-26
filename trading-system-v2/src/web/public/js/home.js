// 目标市场（用户选择的交易市场）
let targetMarket = 'crypto';

// 显示登录/注册模态框
function showAuthModal(market) {
  targetMarket = market;
  document.getElementById('authModal').classList.add('active');
  switchTab('login');
}

// 切换标签
function switchTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabLogin.style.background = '#007bff';
    tabLogin.style.color = 'white';
    tabRegister.style.background = '#f8f9fa';
    tabRegister.style.color = '#666';
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabLogin.style.background = '#f8f9fa';
    tabLogin.style.color = '#666';
    tabRegister.style.background = '#007bff';
    tabRegister.style.color = 'white';
  }
}

// 关闭模态框
function closeModal(event) {
  if (event.target.classList.contains('modal-overlay')) {
    document.getElementById('authModal').classList.remove('active');
  }
}

// 处理登录
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const errorDiv = document.getElementById('authErrorMessage');
  const successDiv = document.getElementById('authSuccessMessage');

  try {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // 保存token
      localStorage.setItem('authToken', data.data.token);
      localStorage.setItem('userInfo', JSON.stringify(data.data.user));

      successDiv.textContent = '登录成功！正在跳转...';
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
      errorDiv.textContent = data.message || '登录失败';
      errorDiv.style.display = 'block';
      successDiv.style.display = 'none';
    }
  } catch (error) {
    errorDiv.textContent = '网络错误，请稍后重试';
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
  }
}

// 处理注册
async function handleRegister(event) {
  event.preventDefault();

  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const name = document.getElementById('regName').value;
  const company = document.getElementById('regCompany').value;

  const errorDiv = document.getElementById('authErrorMessage');
  const successDiv = document.getElementById('authSuccessMessage');

  try {
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, company })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      successDiv.textContent = '注册成功！请登录...';
      successDiv.style.display = 'block';
      errorDiv.style.display = 'none';

      // 切换到登录表单
      setTimeout(() => {
        switchTab('login');
        document.getElementById('email').value = email;
      }, 1500);
    } else {
      errorDiv.textContent = data.message || '注册失败';
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

  // 标签切换按钮
  document.getElementById('tabLogin').addEventListener('click', function() {
    switchTab('login');
  });
  document.getElementById('tabRegister').addEventListener('click', function() {
    switchTab('register');
  });

  // 登录表单提交
  document.getElementById('loginForm').addEventListener('submit', function(e) {
    handleLogin(e);
  });

  // 注册表单提交
  document.getElementById('registerForm').addEventListener('submit', function(e) {
    handleRegister(e);
  });

  // 模态框关闭
  document.getElementById('authModal').addEventListener('click', function(e) {
    closeModal(e);
  });

  // 检查是否已登录
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    // 如果已登录，显示用户信息
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    document.querySelector('.nav-actions').innerHTML = `
      <span style="margin-right: 15px;">欢迎，${userInfo.email}</span>
      <button class="btn-login" id="logoutBtn">退出</button>
    `;
    
    // 退出按钮事件
    document.getElementById('logoutBtn').addEventListener('click', function() {
      logout();
    });
  }
});

