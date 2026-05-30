/**
 * History Manager - GovDocs Pro
 * Handles local storage for processed files history
 */
const STORAGE_KEY = 'govdocs_history';
const MAX_ITEMS = 10;

export const HistoryManager = {
    save({ toolName, preset, size }) {
        const history = this.get();
        const entry = {
            id: Date.now(),
            toolName,
            preset: preset || 'Custom',
            size: size || 'N/A',
            date: new Date().toLocaleString('gu-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        };
        
        history.unshift(entry);
        const limitedHistory = history.slice(0, MAX_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory));
        
        window.dispatchEvent(new CustomEvent('historyUpdated'));
    },

    get() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    clear() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        window.dispatchEvent(new CustomEvent('historyUpdated'));
    }
};