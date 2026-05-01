// modules/lists/list-manager.js - Core list management
class AdvancedListManager {
  constructor() {
    this.lists = new Map();
    this.currentList = null;
    this.listColors = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#84CC16', '#F97316'];
  }

  // List CRUD operations
  createList(name) {
    const listId = Date.now().toString();
    const newList = {
      id: listId,
      name: name,
      positions: [],
      created: new Date().toISOString(),
      color: this.getListColor(listId),
      lockPreview: false
    };
    this.lists.set(listId, newList);
    return newList;
  }

  deleteList(listId) {
    const deleted = this.lists.delete(listId);
    // S'assurer qu'il reste au moins une liste
    if (this.lists.size === 0) {
      const defaultList = this.createList('Liste 0');
      this.save();
    }
    return deleted;
  }

  getList(listId) {
    return this.lists.get(listId);
  }

  getAllLists() {
    return Array.from(this.lists.values());
  }

  setCurrentList(listId) {
    this.currentList = listId ? this.lists.get(listId) : null;
    return this.currentList;
  }

  getCurrentList() {
    return this.currentList;
  }

  // Position operations
  addPosition(x, y, z, name) {
    if (!this.currentList) return null;
    
    const position = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      x: x,
      y: y,
      z: z,
      name: name,
      timestamp: new Date().toISOString()
    };
    
    this.currentList.positions.push(position);
    return position;
  }

  removePosition(positionId) {
    if (!this.currentList) return false;
    
    const initialLength = this.currentList.positions.length;
    this.currentList.positions = this.currentList.positions.filter(p => p.id !== positionId);
    return this.currentList.positions.length < initialLength;
  }

  updatePosition(positionId, updates) {
    if (!this.currentList) return false;
    
    const position = this.currentList.positions.find(p => p.id === positionId);
    if (position) {
      Object.assign(position, updates);
      return true;
    }
    return false;
  }

  getPosition(positionId) {
    if (!this.currentList) return null;
    return this.currentList.positions.find(p => p.id === positionId);
  }

  // Color management
  getListColor(listId) {
    const index = Array.from(this.lists.keys()).indexOf(listId);
    return this.listColors[index % this.listColors.length];
  }

  updateListColor(listId, color) {
    const list = this.lists.get(listId);
    if (list) {
      list.color = color;
      return true;
    }
    return false;
  }

  // Preview lock management
  toggleLockPreview(listId, isLocked) {
    const list = this.lists.get(listId);
    if (list) {
      list.lockPreview = isLocked;
      return true;
    }
    return false;
  }

  hasLockedPreview() {
    return Array.from(this.lists.values()).some(list => list.lockPreview);
  }

  // Data aggregation
  getAllListsPositions() {
    const allPositions = [];
    this.lists.forEach((list, listId) => {
      const color = list.color || this.getListColor(listId);
      list.positions.forEach((pos, index) => {
        allPositions.push({ ...pos, listId, color, positionNumber: index + 1 });
      });
    });
    return allPositions;
  }

  // Persistence
  save() {
    const data = Array.from(this.lists.entries());
    localStorage.setItem('endertrack_lists', JSON.stringify(data));
  }

  load() {
    try {
      const data = localStorage.getItem('endertrack_lists');
      if (data) {
        const entries = JSON.parse(data);
        this.lists = new Map(entries);
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des listes:', error);
    }
    
    // Create default list if none exist
    if (this.lists.size === 0) {
      const defaultList = this.createList('Liste 0');
      this.save();
    }
  }

  clear() {
    this.lists.clear();
    this.currentList = null;
    localStorage.removeItem('endertrack_lists');
    // Toujours créer une liste par défaut
    const defaultList = this.createList('Liste 0');
    this.save();
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.AdvancedListManager = AdvancedListManager;