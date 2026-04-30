// Force Z panel visibility at startup
(function forceZPanelVisible() {
  const zPanel = document.querySelector('.z-visualization-panel');
  if (zPanel) {
    zPanel.style.display = 'flex';
    zPanel.style.visibility = 'visible';
    // console.log('✅ Z panel forced visible at startup');
  }
})();

// Additional safety check after DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const zPanel = document.querySelector('.z-visualization-panel');
    if (zPanel) {
      zPanel.style.display = 'flex';
      zPanel.style.visibility = 'visible';
      // console.log('✅ Z panel visibility confirmed after DOM load');
    }
  }, 100);
});

// Final safety check after all scripts load
window.addEventListener('load', () => {
  setTimeout(() => {
    const zPanel = document.querySelector('.z-visualization-panel');
    if (zPanel) {
      zPanel.style.display = 'flex';
      zPanel.style.visibility = 'visible';
      // console.log('✅ Z panel visibility confirmed after window load');
    }
  }, 200);
});