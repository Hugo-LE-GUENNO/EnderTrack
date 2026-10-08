// modules/canvas/tools-toggle.js - Toggle canvas tools visibility

function toggleCanvasTools() {
  const container = document.querySelector('.canvas-info-container');
  
  if (!container) return;
  
  const isCollapsed = container.classList.toggle('collapsed');
  
  // Save state
  localStorage.setItem('endertrack_tools_collapsed', isCollapsed);
  
  // Re-render minimaps after transition (300ms)
  if (!isCollapsed) {
    // Réinitialiser le cache de largeur
    if (window.EnderTrack?.MiniPreview) {
      window.EnderTrack.MiniPreview.cachedWidth = null;
    }
    
    setTimeout(() => {
      const state = window.EnderTrack?.State?.get();
      if (state) {
        window.EnderTrack?.MiniPreview?.renderInHeader('miniPreviewXY', state);
        window.EnderTrack?.MiniZPreview?.renderInHeader('miniPreviewZ', state);
      }
    }, 350);
  }
}

// Initialize state on load
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.canvas-info-container');
  
  if (!container) return;
  
  // Restore saved state
  const isCollapsed = localStorage.getItem('endertrack_tools_collapsed') === 'true';
  
  if (isCollapsed) {
    container.classList.add('collapsed');
  }
});
