// modules/lists/pattern-generator.js - Pattern generation algorithms
class PatternGenerator {
  static generatePattern(param1, param2, param3, param4, type, offsetX = 0, offsetY = 0, options = {}) {
    let positions = [];
    
    switch (type) {
      case 'grid':
        positions = this.generateGrid(param1, param2, param3, param4, options.sweep);
        break;
      case 'random':
        positions = this.generateRandom(param1, param2, param3, options.order);
        break;
      case 'spiral':
        positions = this.generateSpiral(param1, param2, param3, options.direction);
        break;
      default:
        positions = this.generateGrid(param1, param2, param3, param4);
    }
    
    // Apply offset and check bounds
    const finalPositions = positions.map(pos => ({
      x: pos.x + offsetX,
      y: pos.y + offsetY
    }));
    
    // Check if any position is outside bounds
    const coords = window.EnderTrack?.Coordinates;
    if (coords) {
      const bounds = coords.getCoordinateBounds();
      const outsidePoints = finalPositions.filter(pos => 
        pos.x < bounds.minX || pos.x > bounds.maxX || 
        pos.y < bounds.minY || pos.y > bounds.maxY
      );
      
      if (outsidePoints.length > 0) {
        throw new Error(`${outsidePoints.length} point(s) sont en dehors des limites du plateau (${bounds.minX.toFixed(1)} à ${bounds.maxX.toFixed(1)} mm en X, ${bounds.minY.toFixed(1)} à ${bounds.maxY.toFixed(1)} mm en Y)`);
      }
    }
    
    return finalPositions;
  }

  static generateGrid(cols, rows, stepX, stepY, sweep = 'normal') {
    const positions = [];
    const startX = -(cols - 1) * stepX / 2;
    const startY = -(rows - 1) * stepY / 2;
    
    // Générer la grille de base
    if (sweep === 'snake') {
      for (let row = 0; row < rows; row++) {
        if (row % 2 === 0) {
          for (let col = 0; col < cols; col++) {
            positions.push({ 
              x: startX + col * stepX, 
              y: startY + row * stepY 
            });
          }
        } else {
          for (let col = cols - 1; col >= 0; col--) {
            positions.push({ 
              x: startX + col * stepX, 
              y: startY + row * stepY 
            });
          }
        }
      }
    } else if (sweep === 'reverse') {
      // Normal inversé (de droite à gauche, de bas en haut)
      for (let row = rows - 1; row >= 0; row--) {
        for (let col = cols - 1; col >= 0; col--) {
          positions.push({ 
            x: startX + col * stepX, 
            y: startY + row * stepY 
          });
        }
      }
    } else if (sweep === 'snake-reverse') {
      // Méandre inversé
      for (let row = rows - 1; row >= 0; row--) {
        if ((rows - 1 - row) % 2 === 0) {
          for (let col = cols - 1; col >= 0; col--) {
            positions.push({ 
              x: startX + col * stepX, 
              y: startY + row * stepY 
            });
          }
        } else {
          for (let col = 0; col < cols; col++) {
            positions.push({ 
              x: startX + col * stepX, 
              y: startY + row * stepY 
            });
          }
        }
      }
    } else if (sweep === 'spiral-out') {
      // Spirale du centre vers l'extérieur
      return this.generateGridSpiral(cols, rows, stepX, stepY, startX, startY, false);
    } else if (sweep === 'spiral-in') {
      // Spirale de l'extérieur vers le centre
      return this.generateGridSpiral(cols, rows, stepX, stepY, startX, startY, true);
    } else if (sweep === 'random') {
      // Générer toutes les positions puis les mélanger
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          positions.push({ 
            x: startX + col * stepX, 
            y: startY + row * stepY 
          });
        }
      }
      return this.shuffleArray(positions);
    } else {
      // Normal (par défaut)
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          positions.push({ 
            x: startX + col * stepX, 
            y: startY + row * stepY 
          });
        }
      }
    }
    return positions;
  }

  static generateGridSpiral(cols, rows, stepX, stepY, startX, startY, inward = false) {
    const positions = [];
    const grid = [];
    
    // Créer une grille 2D avec les positions
    for (let row = 0; row < rows; row++) {
      grid[row] = [];
      for (let col = 0; col < cols; col++) {
        grid[row][col] = {
          x: startX + col * stepX,
          y: startY + row * stepY,
          visited: false
        };
      }
    }
    
    // Parcours en spirale
    let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
    
    while (top <= bottom && left <= right) {
      // Droite
      for (let col = left; col <= right; col++) {
        if (grid[top] && grid[top][col]) {
          positions.push({ x: grid[top][col].x, y: grid[top][col].y });
        }
      }
      top++;
      
      // Bas
      for (let row = top; row <= bottom; row++) {
        if (grid[row] && grid[row][right]) {
          positions.push({ x: grid[row][right].x, y: grid[row][right].y });
        }
      }
      right--;
      
      // Gauche
      if (top <= bottom) {
        for (let col = right; col >= left; col--) {
          if (grid[bottom] && grid[bottom][col]) {
            positions.push({ x: grid[bottom][col].x, y: grid[bottom][col].y });
          }
        }
        bottom--;
      }
      
      // Haut
      if (left <= right) {
        for (let row = bottom; row >= top; row--) {
          if (grid[row] && grid[row][left]) {
            positions.push({ x: grid[row][left].x, y: grid[row][left].y });
          }
        }
        left++;
      }
    }
    
    return inward ? positions.reverse() : positions;
  }

  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static generateRandom(points, width, height, order = 'random') {
    const positions = [];
    
    for (let i = 0; i < points; i++) {
      positions.push({
        x: (Math.random() - 0.5) * width,
        y: (Math.random() - 0.5) * height
      });
    }
    
    if (order === 'nearest') {
      return this.sortByNearest(positions);
    }
    
    return positions;
  }

  static generateSpiral(turns, radius, points, direction = 'outward') {
    const positions = [];
    const angleStep = (turns * 2 * Math.PI) / points;
    
    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      const angle = i * angleStep;
      const r = radius * t;
      
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      
      positions.push({ x, y });
    }
    
    if (direction === 'inward') {
      return positions.reverse();
    }
    
    return positions;
  }

  static sortByNearest(positions) {
    if (positions.length <= 1) return positions;
    
    const sorted = [positions[0]];
    const remaining = positions.slice(1);
    
    while (remaining.length > 0) {
      const current = sorted[sorted.length - 1];
      let nearestIndex = 0;
      let nearestDistance = this.distance(current, remaining[0]);
      
      for (let i = 1; i < remaining.length; i++) {
        const distance = this.distance(current, remaining[i]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      sorted.push(remaining[nearestIndex]);
      remaining.splice(nearestIndex, 1);
    }
    
    return sorted;
  }

  static distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.PatternGenerator = PatternGenerator;