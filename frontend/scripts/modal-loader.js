/**
 * Modal Loader - Dynamic modal loading system
 * Loads modals on-demand to reduce initial HTML size
 */

window.ModalLoader = {
    loadedModals: new Set(),
    
    async load(modalName) {
        if (this.loadedModals.has(modalName)) {
            return true;
        }
        
        try {
            const response = await fetch(`frontend/components/modals/${modalName}.html`);
            if (!response.ok) throw new Error(`Modal ${modalName} not found`);
            
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html);
            
            this.loadedModals.add(modalName);
            return true;
        } catch (error) {
            console.error(`Failed to load modal ${modalName}:`, error);
            return false;
        }
    },
    
    async show(modalName) {
        await this.load(modalName);
        const modal = document.getElementById(modalName);
        if (modal) modal.style.display = 'block';
    }
};
