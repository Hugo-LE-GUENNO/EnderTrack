// modules/lists/list-io.js - Import/Export functionality
class ListIO {
  static exportLists(lists) {
    const data = {
      lists: Array.from(lists.entries()),
      exported: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endertrack-lists-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static importLists(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.lists) {
            callback(new Map(data.lists), null);
          } else {
            callback(null, 'Format de fichier invalide');
          }
        } catch (error) {
          callback(null, 'Erreur lors de la lecture du fichier');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  static loadListFromFile(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.lists) {
            // Generate new IDs to avoid conflicts
            const importedLists = new Map();
            const originalLists = new Map(data.lists);
            
            originalLists.forEach((list, id) => {
              const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
              list.id = newId;
              importedLists.set(newId, list);
            });
            
            callback(importedLists, null);
          } else {
            callback(null, 'Format de fichier invalide');
          }
        } catch (error) {
          callback(null, 'Erreur lors de la lecture du fichier');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ListIO = ListIO;