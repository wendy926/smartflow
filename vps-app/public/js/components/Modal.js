// public/js/components/Modal.js - 模态框组件

class Modal {
  constructor() {
    this.currentModal = null;
  }

  show(title, content, options = {}) {
    // 关闭现有模态框
    this.close();

    // 创建模态框HTML
    const modalHtml = `
            <div class="modal" id="currentModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="close-btn" onclick="modal.close()">×</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                </div>
            </div>
        `;

    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.currentModal = document.getElementById('currentModal');

    // 添加ESC键关闭
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escHandler);

    // 添加背景点击关闭
    this.currentModal.addEventListener('click', (e) => {
      if (e.target === this.currentModal) {
        this.close();
      }
    });

    // 添加关闭动画
    setTimeout(() => {
      if (this.currentModal) {
        this.currentModal.style.opacity = '1';
      }
    }, 10);
  }

  close() {
    if (this.currentModal) {
      // 添加关闭动画
      this.currentModal.style.opacity = '0';
      this.currentModal.style.transform = 'scale(0.9)';

      setTimeout(() => {
        if (this.currentModal && this.currentModal.parentNode) {
          this.currentModal.remove();
        }
        this.currentModal = null;
      }, 200);
    }

    // 移除事件监听器
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
  }

  // 显示消息提示
  showMessage(message, type = 'info', duration = 3000) {
    const messageHtml = `
            <div class="message ${type}">
                ${message}
            </div>
        `;

    // 创建临时消息容器
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
    messageContainer.innerHTML = messageHtml;

    document.body.appendChild(messageContainer);

    // 自动移除
    setTimeout(() => {
      if (messageContainer.parentNode) {
        messageContainer.style.opacity = '0';
        messageContainer.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (messageContainer.parentNode) {
            messageContainer.remove();
          }
        }, 300);
      }
    }, duration);
  }

  // 显示确认对话框
  async confirm(message, title = '确认') {
    return new Promise((resolve) => {
      const content = `
                <div style="text-align: center; padding: 20px;">
                    <p style="margin-bottom: 20px; font-size: 16px;">${message}</p>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button class="btn primary" onclick="modal.confirmResult(true)">确认</button>
                        <button class="btn secondary" onclick="modal.confirmResult(false)">取消</button>
                    </div>
                </div>
            `;

      this.show(title, content);
      this.confirmResolve = resolve;
    });
  }

  confirmResult(result) {
    this.close();
    if (this.confirmResolve) {
      this.confirmResolve(result);
      this.confirmResolve = null;
    }
  }
}

// 创建全局模态框实例
window.modal = new Modal();
