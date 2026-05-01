// modules/lists/list-executor.js - List execution and navigation
class ListExecutor {
  constructor() {
    this.isExecuting = false;
    this.currentSequence = null;
    this.currentIndex = 0;
  }

  async executeList(positions) {
    if (!positions || positions.length === 0) {
      console.warn('Aucune position à exécuter');
      return false;
    }

    if (this.isExecuting) {
      console.warn('Une séquence est déjà en cours d\'exécution');
      return false;
    }

    console.log(`🎯 Début d'exécution de ${positions.length} positions`);
    this.isExecuting = true;
    this.currentSequence = positions;
    this.currentIndex = 0;

    try {
      await this.executeSequence();
      console.log('✅ Exécution de la liste terminée');
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'exécution:', error);
      return false;
    } finally {
      this.isExecuting = false;
      this.currentSequence = null;
      this.currentIndex = 0;
    }
  }

  async executeSequence() {
    while (this.currentIndex < this.currentSequence.length && this.isExecuting) {
      const position = this.currentSequence[this.currentIndex];
      
      console.log(`🎯 Déplacement vers: ${position.name} (${position.x}, ${position.y}, ${position.z})`);
      
      // Move to position
      await this.moveToPosition(position);
      
      // Wait before next position
      await this.delay(1000);
      
      this.currentIndex++;
    }
  }

  async moveToPosition(position) {
    // Utiliser le système de mouvement normal pour avoir l'animation, la trace, etc.
    if (window.EnderTrack?.Movement?.moveAbsolute) {
      await window.EnderTrack.Movement.moveAbsolute(position.x, position.y, position.z);
    }
  }

  goToPosition(position) {
    if (!position) return false;
    
    // Validate coordinates using new coordinate system
    const coords = window.EnderTrack?.Coordinates;
    if (coords) {
      const bounds = coords.getCoordinateBounds();
      const isValid = position.x >= bounds.minX && position.x <= bounds.maxX &&
                     position.y >= bounds.minY && position.y <= bounds.maxY &&
                     position.z >= bounds.minZ && position.z <= bounds.maxZ;
      
      if (!isValid) {
        console.warn(`Position hors limites: (${position.x}, ${position.y}, ${position.z})`);
        return false;
      }
    }
    
    console.log(`🎯 Déplacement vers: ${position.name} (${position.x}, ${position.y}, ${position.z})`);
    
    if (window.EnderTrack?.State?.update) {
      window.EnderTrack.State.update({
        pos: { x: position.x, y: position.y, z: position.z }
      });
      return true;
    }
    
    return false;
  }

  stopExecution() {
    if (this.isExecuting) {
      console.log('⏹️ Arrêt de l\'exécution demandé');
      this.isExecuting = false;
      return true;
    }
    return false;
  }

  getExecutionStatus() {
    return {
      isExecuting: this.isExecuting,
      currentIndex: this.currentIndex,
      totalPositions: this.currentSequence ? this.currentSequence.length : 0,
      progress: this.currentSequence ? (this.currentIndex / this.currentSequence.length) * 100 : 0
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ListExecutor = ListExecutor;