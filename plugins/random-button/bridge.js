class RandomButtonBridge {
  constructor() {
    this.icons = ['🎲', '🤪', '🤖', '🎯', '💥', '🔮', '🎉', '🤯', '🚀', '🧨'];
    this.messages = [
      "Pourquoi as-tu cliqué ?",
      "C'est complètement inutile !",
      "Le bouton a gagné... ou pas.",
      "Tu devrais faire autre chose.",
      "Ce bouton ne sert à rien.",
      "42",
      "La réponse est non.",
      "Essaie encore !",
      "C'est magique ! (ou pas)",
      "Le développeur s'excuse pour ce bouton."
    ];
    this.colors = [
      '#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3',
      '#33FFF3', '#8A2BE2', '#FF6347', '#7CFC00', '#FFD700'
    ];
  }

  activate() {
    console.log("RandomButton activé (mais toujours inutile)");
  }

  deactivate() {
    console.log("RandomButton désactivé (dommage)");
  }

  getStatus() {
    return { connected: true, useless: true };
  }

  getRandomAction() {
    const icon = this.icons[Math.floor(Math.random() * this.icons.length)];
    const message = this.messages[Math.floor(Math.random() * this.messages.length)];
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];

    return { icon, message, color };
  }

  doSomethingUseless() {
    const { icon, message, color } = this.getRandomAction();
    EnderTrack.UI.showNotification(message, 'info');
    return { icon, color };
  }
}

window.RandomButtonBridge = RandomButtonBridge;
