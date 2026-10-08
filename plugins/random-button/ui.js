class RandomButtonPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this.navContainer = null;
    this.currentIcon = manifest.icon;
    this.currentColor = '#888';
  }

  init() {
    this.injectNavButton();
  }

  destroy() {
    this.navContainer?.remove();
  }

  injectNavButton() {
    const navContent = document.getElementById('navigationTabContent');
    if (!navContent) return;

    this.navContainer = document.createElement('div');
    this.navContainer.className = 'enderscope-nav-bar';
    this.navContainer.id = 'random-button-nav';

    const label = document.createElement('span');
    label.className = 'enderscope-nav-label';
    label.textContent = `${this.manifest.icon} ${this.manifest.name}`;
    this.navContainer.appendChild(label);

    const btn = document.createElement('button');
    btn.className = 'enderscope-nav-btn';
    btn.id = 'random-button-nav-btn';
    btn.innerHTML = this.currentIcon;
    btn.style.color = this.currentColor;
    btn.title = "Bouton complètement inutile";

    btn.onclick = () => {
      const result = this.bridge.doSomethingUseless();
      this.currentIcon = result.icon;
      this.currentColor = result.color;
      btn.innerHTML = this.currentIcon;
      btn.style.color = this.currentColor;
      btn.classList.add('animated');
      setTimeout(() => btn.classList.remove('animated'), 300);
    };

    this.navContainer.appendChild(btn);
    navContent.insertBefore(this.navContainer, navContent.firstChild);
  }
}

window.RandomButtonPluginUI = RandomButtonPluginUI;
