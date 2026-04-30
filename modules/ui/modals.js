// modules/ui/modals.js - Modal dialog system

class ModalSystem {
  constructor() {
    this.modals = new Map();
    this.isInitialized = false;
    this.zIndexBase = 10000;
  }

  init() {
    
    // Setup global event listeners
    this.setupGlobalEvents();
    
    this.isInitialized = true;
    
    return true;
  }

  setupGlobalEvents() {
    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeTopModal();
      }
    });
  }

  show(options = {}) {
    const {
      title = 'Modal',
      content = '',
      size = 'medium', // small, medium, large, fullscreen
      closable = true,
      backdrop = true,
      backdropClose = true,
      buttons = [],
      onShow = null,
      onHide = null,
      className = ''
    } = options;

    const modalId = this.generateId();
    
    // Create modal structure
    const modal = this.createModal({
      id: modalId,
      title,
      content,
      size,
      closable,
      backdrop,
      backdropClose,
      buttons,
      className
    });

    // Store modal data
    this.modals.set(modalId, {
      element: modal,
      options,
      onShow,
      onHide
    });

    // Add to DOM
    document.body.appendChild(modal);

    // Trigger show animation
    requestAnimationFrame(() => {
      modal.classList.add('show');
      
      if (onShow) {
        onShow(modalId);
      }
      
      EnderTrack.Events?.emit?.('ui:modal:opened', { id: modalId, options });
    });

    return modalId;
  }

  createModal(config) {
    const { id, title, content, size, closable, backdrop, backdropClose, buttons, className } = config;
    
    // Main modal container
    const modal = document.createElement('div');
    modal.className = `modal ${className}`;
    modal.id = id;
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: ${this.zIndexBase + this.modals.size};
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Backdrop
    if (backdrop) {
      const backdropEl = document.createElement('div');
      backdropEl.className = 'modal-backdrop';
      backdropEl.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
      `;
      
      if (backdropClose) {
        backdropEl.addEventListener('click', () => {
          this.hide(id);
        });
      }
      
      modal.appendChild(backdropEl);
    }

    // Modal dialog with Enderscope theme
    const dialog = document.createElement('div');
    dialog.className = `modal-dialog modal-${size}`;
    dialog.style.cssText = `
      position: relative;
      background: var(--container-bg);
      color: var(--text-general);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      max-height: 90vh;
      overflow: hidden;
      transform: scale(0.9);
      transition: transform 0.2s ease;
      border: 1px solid #444;
      ${this.getSizeStyles(size)}
    `;

    // Modal header
    if (title || closable) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #444;
        background: var(--app-bg);
      `;

      if (title) {
        const titleEl = document.createElement('h3');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        titleEl.style.cssText = `
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-selected);
        `;
        header.appendChild(titleEl);
      }

      if (closable) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-general);
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-small);
          transition: all 0.2s ease;
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
          closeBtn.style.background = 'var(--active-element)';
          closeBtn.style.color = 'var(--text-selected)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
          closeBtn.style.background = 'none';
          closeBtn.style.color = 'var(--text-general)';
        });
        
        closeBtn.addEventListener('click', () => {
          this.hide(id);
        });
        
        header.appendChild(closeBtn);
      }

      dialog.appendChild(header);
    }

    // Modal body with Enderscope theme
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = `
      padding: 20px;
      overflow-y: auto;
      max-height: calc(90vh - 120px);
      background: var(--container-bg);
    `;

    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }

    dialog.appendChild(body);

    // Modal footer
    if (buttons.length > 0) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      footer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid #444;
        background: var(--app-bg);
      `;

      buttons.forEach(button => {
        const btn = this.createButton(button, id);
        footer.appendChild(btn);
      });

      dialog.appendChild(footer);
    }

    modal.appendChild(dialog);
    
    // Add show class for animation
    modal.addEventListener('transitionend', () => {
      if (modal.classList.contains('show')) {
        dialog.style.transform = 'scale(1)';
      }
    });

    return modal;
  }

  createButton(buttonConfig, modalId) {
    const {
      text = 'Button',
      type = 'default', // primary, secondary, danger, default
      handler = null,
      closeModal = true
    } = buttonConfig;

    const button = document.createElement('button');
    button.className = `modal-btn modal-btn-${type}`;
    button.textContent = text;
    
    const baseStyles = `
      padding: 8px 16px;
      border-radius: var(--radius-small);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid;
    `;
    
    const typeStyles = {
      primary: `
        background: var(--active-element);
        color: var(--text-selected);
        border-color: var(--active-element);
      `,
      secondary: `
        background: var(--container-bg);
        color: var(--text-general);
        border-color: #444;
      `,
      danger: `
        background: #ef4444;
        color: white;
        border-color: #ef4444;
      `,
      default: `
        background: var(--app-bg);
        color: var(--text-general);
        border-color: #444;
      `
    };
    
    button.style.cssText = baseStyles + typeStyles[type];
    
    // Hover effects with Enderscope theme
    button.addEventListener('mouseenter', () => {
      switch (type) {
        case 'primary':
          button.style.background = 'var(--coordinates-color)';
          button.style.color = '#000';
          break;
        case 'secondary':
          button.style.background = 'var(--active-element)';
          button.style.color = 'var(--text-selected)';
          break;
        case 'danger':
          button.style.background = '#dc2626';
          break;
        case 'default':
          button.style.background = 'var(--active-element)';
          button.style.color = 'var(--text-selected)';
          break;
      }
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.cssText = baseStyles + typeStyles[type];
    });

    button.addEventListener('click', () => {
      if (handler) {
        const result = handler(modalId);
        
        // If handler returns false, don't close modal
        if (result === false) {
          return;
        }
      }

      if (closeModal) {
        this.hide(modalId);
      }
    });

    return button;
  }

  getSizeStyles(size) {
    const sizes = {
      small: 'width: 400px; min-height: 200px;',
      medium: 'width: 600px; min-height: 300px;',
      large: 'width: 800px; min-height: 400px;',
      fullscreen: 'width: 95vw; height: 95vh;'
    };
    
    return sizes[size] || sizes.medium;
  }

  hide(modalId) {
    const modalData = this.modals.get(modalId);
    if (!modalData) return;

    const { element, onHide } = modalData;
    
    // Trigger hide animation
    element.style.opacity = '0';
    const dialog = element.querySelector('.modal-dialog');
    if (dialog) {
      dialog.style.transform = 'scale(0.9)';
    }

    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      
      this.modals.delete(modalId);
      
      if (onHide) {
        onHide(modalId);
      }
      
      EnderTrack.Events?.emit?.('ui:modal:closed', { id: modalId });
    }, 300);
  }

  hideAll() {
    const modalIds = Array.from(this.modals.keys());
    modalIds.forEach(id => this.hide(id));
  }

  closeTopModal() {
    const modalIds = Array.from(this.modals.keys());
    if (modalIds.length > 0) {
      const topModalId = modalIds[modalIds.length - 1];
      this.hide(topModalId);
    }
  }

  // Convenience methods
  alert(message, title = 'Alert') {
    return this.show({
      title,
      content: `<p style="margin: 0; font-size: 14px; line-height: 1.5;">${message}</p>`,
      size: 'small',
      buttons: [
        {
          text: 'OK',
          type: 'primary'
        }
      ]
    });
  }

  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      this.show({
        title,
        content: `<p style="margin: 0; font-size: 14px; line-height: 1.5;">${message}</p>`,
        size: 'small',
        buttons: [
          {
            text: 'Cancel',
            type: 'secondary',
            handler: () => {
              resolve(false);
            }
          },
          {
            text: 'OK',
            type: 'primary',
            handler: () => {
              resolve(true);
            }
          }
        ]
      });
    });
  }

  prompt(message, defaultValue = '', title = 'Input') {
    return new Promise((resolve) => {
      const inputId = 'modal-prompt-input';
      
      const content = `
        <div>
          <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.5;">${message}</p>
          <input type="text" id="${inputId}" value="${defaultValue}" 
                 style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
        </div>
      `;
      
      const modalId = this.show({
        title,
        content,
        size: 'small',
        buttons: [
          {
            text: 'Cancel',
            type: 'secondary',
            handler: () => {
              resolve(null);
            }
          },
          {
            text: 'OK',
            type: 'primary',
            handler: () => {
              const input = document.getElementById(inputId);
              resolve(input ? input.value : '');
            }
          }
        ],
        onShow: () => {
          // Focus input after modal is shown
          setTimeout(() => {
            const input = document.getElementById(inputId);
            if (input) {
              input.focus();
              input.select();
            }
          }, 100);
        }
      });
      
      // Handle Enter key
      setTimeout(() => {
        const input = document.getElementById(inputId);
        if (input) {
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              resolve(input.value);
              this.hide(modalId);
            }
          });
        }
      }, 100);
    });
  }

  loading(message = 'Loading...', title = 'Please wait') {
    const content = `
      <div style="text-align: center; padding: 20px;">
        <div style="width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">${message}</p>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    return this.show({
      title,
      content,
      size: 'small',
      closable: false,
      backdropClose: false
    });
  }

  // Utility methods
  generateId() {
    return `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isOpen(modalId = null) {
    if (modalId) {
      return this.modals.has(modalId);
    }
    return this.modals.size > 0;
  }

  getOpenModals() {
    return Array.from(this.modals.keys());
  }

  // Debug information
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      openModals: this.getOpenModals(),
      modalCount: this.modals.size
    };
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.UI = window.EnderTrack.UI || {};
window.EnderTrack.UI.Modals = new ModalSystem();

// Convenience aliases
window.EnderTrack.UI.showModal = (options) => {
  return window.EnderTrack.UI.Modals.show(options);
};

window.EnderTrack.UI.alert = (message, title) => {
  return window.EnderTrack.UI.Modals.alert(message, title);
};

window.EnderTrack.UI.confirm = (message, title) => {
  return window.EnderTrack.UI.Modals.confirm(message, title);
};

window.EnderTrack.UI.prompt = (message, defaultValue, title) => {
  return window.EnderTrack.UI.Modals.prompt(message, defaultValue, title);
};