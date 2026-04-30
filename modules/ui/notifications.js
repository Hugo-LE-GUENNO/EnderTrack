// modules/ui/notifications.js - User notification system

class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.container = null;
    this.maxNotifications = 5;
    this.defaultDuration = 4000;
    this.isInitialized = false;
  }

  init() {
    
    // Create notification container
    this.createContainer();
    
    this.isInitialized = true;
    
    return true;
  }

  createContainer() {
    // Remove existing container if any
    const existing = document.getElementById('notification-container');
    if (existing) {
      existing.remove();
    }

    // Create new container
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    
    // Add styles
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      max-width: 400px;
    `;
    
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', options = {}) {
    if (!this.isInitialized) {
      this.init();
    }

    const {
      duration = this.defaultDuration,
      persistent = false,
      actions = [],
      icon = null,
      title = null
    } = options;

    // Create notification object
    const notification = {
      id: this.generateId(),
      message,
      type,
      title,
      icon: icon || this.getDefaultIcon(type),
      duration,
      persistent,
      actions,
      timestamp: Date.now(),
      element: null
    };

    // Create DOM element
    notification.element = this.createElement(notification);
    
    // Add to container
    this.container.appendChild(notification.element);
    
    // Add to notifications array
    this.notifications.push(notification);
    
    // Trigger entrance animation
    requestAnimationFrame(() => {
      notification.element.classList.add('show');
    });
    
    // Auto-remove if not persistent
    if (!persistent && duration > 0) {
      setTimeout(() => {
        this.remove(notification.id);
      }, duration);
    }
    
    // Limit number of notifications
    this.limitNotifications();
    
    // Emit event
    EnderTrack.Events?.emit?.('ui:notification', notification);
    
    return notification.id;
  }

  createElement(notification) {
    const element = document.createElement('div');
    element.className = `notification notification-${notification.type}`;
    element.dataset.id = notification.id;
    
    // Base styles with Enderscope theme
    element.style.cssText = `
      background: var(--container-bg);
      color: var(--text-general);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 16px;
      margin-bottom: 8px;
      transform: translateX(100%);
      transition: all 0.2s ease;
      pointer-events: auto;
      border-left: 4px solid ${this.getTypeColor(notification.type)};
      max-width: 100%;
      word-wrap: break-word;
      border: 1px solid #444;
    `;
    
    // Content structure
    let content = `
      <div class="notification-content" style="display: flex; align-items: flex-start; gap: 12px;">
        <div class="notification-icon" style="font-size: 20px; flex-shrink: 0; color: ${this.getTypeColor(notification.type)};">
          ${notification.icon}
        </div>
        <div class="notification-body" style="flex: 1; min-width: 0;">
    `;
    
    if (notification.title) {
      content += `
        <div class="notification-title title-base" style="margin-bottom: 4px; color: var(--text-selected);">
          ${this.escapeHtml(notification.title)}
        </div>
      `;
    }
    
    content += `
          <div class="notification-message text-sm" style="color: var(--text-general); line-height: 1.4;">
            ${this.escapeHtml(notification.message)}
          </div>
    `;
    
    // Actions with Enderscope button styling
    if (notification.actions.length > 0) {
      content += `
        <div class="notification-actions" style="margin-top: 12px; display: flex; gap: 8px;">
      `;
      
      notification.actions.forEach(action => {
        content += `
          <button class="notification-action btn text-xs" 
                  style="padding: 4px 12px; border: 1px solid #444; background: var(--app-bg); color: var(--text-general); border-radius: var(--radius-small); cursor: pointer; transition: all 0.2s ease;"
                  onclick="EnderTrack.UI.Notifications.handleAction('${notification.id}', '${action.id}')">
            ${this.escapeHtml(action.label)}
          </button>
        `;
      });
      
      content += `</div>`;
    }
    
    content += `
        </div>
        <button class="notification-close" 
                style="background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-general); padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-small); transition: all 0.2s ease;"
                onclick="EnderTrack.UI.Notifications.remove('${notification.id}')"
                onmouseover="this.style.background='var(--active-element)'; this.style.color='var(--text-selected)'"
                onmouseout="this.style.background='none'; this.style.color='var(--text-general)'"
                title="Fermer">
          ×
        </button>
      </div>
    `;
    
    element.innerHTML = content;
    
    // Add show class for animation
    element.classList.add('notification-enter');
    
    return element;
  }

  remove(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (!notification) return;
    
    // Animate out
    if (notification.element) {
      notification.element.style.transform = 'translateX(100%)';
      notification.element.style.opacity = '0';
      
      setTimeout(() => {
        if (notification.element && notification.element.parentNode) {
          notification.element.parentNode.removeChild(notification.element);
        }
      }, 300);
    }
    
    // Remove from array
    this.notifications = this.notifications.filter(n => n.id !== id);
    
    // Emit event
    EnderTrack.Events?.emit?.('ui:notification:removed', id);
  }

  removeAll() {
    this.notifications.forEach(notification => {
      this.remove(notification.id);
    });
  }

  handleAction(notificationId, actionId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    const action = notification.actions.find(a => a.id === actionId);
    if (!action) return;
    
    // Execute action
    if (action.handler) {
      try {
        action.handler(notification);
      } catch (error) {
        console.error('Notification action error:', error);
      }
    }
    
    // Remove notification if action specifies
    if (action.removeOnClick !== false) {
      this.remove(notificationId);
    }
  }

  limitNotifications() {
    while (this.notifications.length > this.maxNotifications) {
      const oldest = this.notifications[0];
      this.remove(oldest.id);
    }
  }

  // Convenience methods
  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  error(message, options = {}) {
    return this.show(message, 'error', { duration: 6000, ...options });
  }

  warning(message, options = {}) {
    return this.show(message, 'warning', { duration: 5000, ...options });
  }

  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  // Utility methods
  generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getDefaultIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  }

  getTypeColor(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    return colors[type] || '#3b82f6';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Advanced notification types
  showProgress(message, options = {}) {
    const { progress = 0, total = 100 } = options;
    
    const progressHtml = `
      <div style="margin-top: 8px;">
        <div style="background: #f3f4f6; border-radius: 4px; height: 6px; overflow: hidden;">
          <div style="background: #3b82f6; height: 100%; width: ${(progress / total) * 100}%; transition: width 0.3s ease;"></div>
        </div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">
          ${progress}/${total} (${Math.round((progress / total) * 100)}%)
        </div>
      </div>
    `;
    
    return this.show(message + progressHtml, 'info', { 
      persistent: true, 
      duration: 0,
      ...options 
    });
  }

  updateProgress(id, progress, total = 100) {
    const notification = this.notifications.find(n => n.id === id);
    if (!notification || !notification.element) return;
    
    const progressBar = notification.element.querySelector('[style*="background: #3b82f6"]');
    const progressText = notification.element.querySelector('[style*="font-size: 12px"]');
    
    if (progressBar) {
      progressBar.style.width = `${(progress / total) * 100}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${progress}/${total} (${Math.round((progress / total) * 100)}%)`;
    }
    
    // Auto-remove when complete
    if (progress >= total) {
      setTimeout(() => {
        this.remove(id);
      }, 2000);
    }
  }

  showConfirm(message, options = {}) {
    const { 
      title = 'Confirmation',
      confirmText = 'Confirmer',
      cancelText = 'Annuler',
      onConfirm = null,
      onCancel = null
    } = options;
    
    return this.show(message, 'warning', {
      title,
      persistent: true,
      duration: 0,
      actions: [
        {
          id: 'confirm',
          label: confirmText,
          handler: (notification) => {
            if (onConfirm) onConfirm();
          }
        },
        {
          id: 'cancel',
          label: cancelText,
          handler: (notification) => {
            if (onCancel) onCancel();
          }
        }
      ]
    });
  }

  // System notifications for EnderTrack
  showMovementError(error) {
    return this.error(`Erreur de mouvement: ${error}`, {
      title: 'Mouvement Échoué',
      actions: [
        {
          id: 'retry',
          label: 'Réessayer',
          handler: () => {
            // This would trigger a retry of the last movement
            EnderTrack.Events?.emit?.('movement:retry');
          }
        }
      ]
    });
  }

  showConnectionStatus(isConnected, service) {
    const message = isConnected 
      ? `Connecté à ${service}`
      : `Déconnecté de ${service}`;
    
    const type = isConnected ? 'success' : 'warning';
    
    return this.show(message, type, {
      title: 'État de Connexion',
      duration: 3000
    });
  }

  showPluginStatus(pluginName, status) {
    const messages = {
      loaded: `Plugin ${pluginName} chargé`,
      activated: `Plugin ${pluginName} activé`,
      deactivated: `Plugin ${pluginName} désactivé`,
      error: `Erreur avec le plugin ${pluginName}`
    };
    
    const types = {
      loaded: 'info',
      activated: 'success',
      deactivated: 'warning',
      error: 'error'
    };
    
    return this.show(messages[status] || `Plugin ${pluginName}: ${status}`, types[status] || 'info');
  }

  // Debug and testing
  test() {
    this.success('Test de notification réussie !');
    
    setTimeout(() => {
      this.warning('Attention: ceci est un test');
    }, 1000);
    
    setTimeout(() => {
      this.error('Erreur de test (normal)');
    }, 2000);
    
    setTimeout(() => {
      this.info('Information de test');
    }, 3000);
  }

  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      notificationCount: this.notifications.length,
      maxNotifications: this.maxNotifications,
      notifications: this.notifications.map(n => ({
        id: n.id,
        type: n.type,
        message: n.message,
        timestamp: n.timestamp
      }))
    };
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.UI = window.EnderTrack.UI || {};
window.EnderTrack.UI.Notifications = new NotificationSystem();

// Convenience alias
window.EnderTrack.UI.showNotification = (message, type, options) => {
  return window.EnderTrack.UI.Notifications.show(message, type, options);
};

window.EnderTrack.UI.showError = (message, options) => {
  return window.EnderTrack.UI.Notifications.error(message, options);
};