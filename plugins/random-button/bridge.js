class RandomButtonBridge {
  constructor() {
    this.icons = ['🎲', '🤪', '🤖', '🎯', '💥', '🔮', '🎉', '🤯', '🚀', '🧨'];
    this.messages = [
      "Why did you click?",
      "This is completely useless !",
      "The button won... or not.",
      "Tu devrais faire autre chose.",
      "This button does nothing.",
      "42",
      "The answer is no.",
      "Essaie encore !",
      "C'est magique ! (ou pas)",
      "The developer apologizes for this button."
    ];
    this.colors = [
      '#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3',
      '#33FFF3', '#8A2BE2', '#FF6347', '#7CFC00', '#FFD700'
    ];
  }

  activate() {
    console.log("RandomButton activated (mais toujours inutile)");
  }

  deactivate() {
    console.log("RandomButton deactivated (too bad)");
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
