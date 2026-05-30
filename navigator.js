/**
 * Navigator Component - GovDocs Pro
 * Centralized tool registry and navigation UI
 */
import { HistoryManager } from './history-manager.js';
import { Header } from './header.js';

const TOOLS = [
    { id: 'photo-resize', title: 'Photo Resize', desc: 'Adjust Height/Width', gu: 'ફોટો રીસાઇઝ', cat: 'Photo Tools', link: 'photo-resize.html', icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5' },
    { id: 'photo-compress', title: 'Photo Compress', desc: 'Reduce File Size (KB)', gu: 'ફોટો કમ્પ્રેસ', cat: 'Photo Tools', link: 'photo-compress.html', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3' },
    { id: 'passport-photo', title: 'Passport Maker', desc: 'Generate Passport Sizes', gu: 'પાસપોર્ટ ફોટો', cat: 'Photo Tools', link: 'passport-photo.html', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'signature-resize', title: 'Signature Resize', desc: 'Resize & Transparent BG', gu: 'સહી રીસાઇઝ', cat: 'Signature Tools', link: 'signature-resize.html', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
    { id: 'pdf-merge', title: 'PDF Merge', desc: 'Combine multiple PDFs', gu: 'PDF મર્જ', cat: 'PDF Tools', link: 'pdf-merge.html', icon: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'ssc-preset', title: 'SSC Presets', desc: 'Government Job Sizes', gu: 'SSC માપદંડ', cat: 'Government Presets', link: 'photo-resize.html', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04' }
];

export const Navigator = {
    init() {
        Header.render();
        this.injectSidebar();
        this.renderHistory();
        this.bindEvents();
    },

    injectSidebar() {
        const sidebarHtml = `
            <div id="nav-overlay" class="fixed inset-0 bg-slate-900/50 z-[60] hidden backdrop-blur-sm transition-opacity"></div>
            <aside id="nav-sidebar" class="fixed top-0 left-0 h-full w-80 bg-white z-[70] shadow-2xl transform -translate-x-full transition-transform duration-300 ease-in-out flex flex-col">
                <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 class="text-xl font-black">All <span class="text-blue-600">Tools</span></h2>
                    <button id="close-nav" class="p-2 hover:bg-slate-100 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div class="p-4 border-b border-slate-50">
                    <div class="relative">
                        <input type="text" id="tool-search" placeholder="Search tools..." class="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-4 top-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-4 space-y-8">
                    <div id="tools-list" class="space-y-8">
                        <!-- Content injected via renderTools -->
                    </div>
                    
                    <div id="history-section" class="pt-6 border-t border-slate-100">
                        <div class="flex items-center justify-between mb-4 px-2">
                            <h3 class="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Recent History</h3>
                            <button id="clear-history" class="text-[9px] font-bold text-red-500 hover:underline">Clear All</button>
                        </div>
                        <div id="history-list" class="space-y-2"></div>
                    </div>
                </div>
            </aside>
        `;
        document.body.insertAdjacentHTML('beforeend', sidebarHtml);
        this.renderTools();
    },

    renderTools(filter = '') {
        const list = document.getElementById('tools-list');
        const groups = {};

        const filtered = TOOLS.filter(t => 
            t.title.toLowerCase().includes(filter.toLowerCase()) || 
            t.gu.includes(filter)
        );

        filtered.forEach(tool => {
            if (!groups[tool.cat]) groups[tool.cat] = [];
            groups[tool.cat].push(tool);
        });

        list.innerHTML = Object.entries(groups).map(([cat, tools]) => `
            <div>
                <h3 class="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 ml-2">${cat}</h3>
                <div class="space-y-1">
                    ${tools.map(t => `
                        <a href="${t.link}" class="flex items-center gap-4 p-3 rounded-xl hover:bg-blue-50 group transition-all">
                            <div class="w-10 h-10 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${t.icon}" /></svg>
                            </div>
                            <div>
                                <div class="text-sm font-bold text-slate-900">${t.title}</div>
                                <div class="text-[10px] text-slate-500 font-medium">${t.gu}</div>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </div>
        `).join('');

        if (filtered.length === 0) {
            list.innerHTML = `<div class="text-center py-12 text-slate-400 text-sm">No tools found matching "${filter}"</div>`;
        }
    },

    renderHistory() {
        const container = document.getElementById('history-list');
        if (!container) return;
        
        const history = HistoryManager.get();
        if (history.length === 0) {
            container.innerHTML = `<p class="text-[10px] text-slate-400 italic px-2">No recent downloads yet.</p>`;
            return;
        }

        container.innerHTML = history.map(item => `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                <div class="flex justify-between items-start mb-1">
                    <span class="text-xs font-bold text-slate-900">${item.toolName}</span>
                    <span class="text-[9px] text-slate-400 font-medium">${item.date}</span>
                </div>
                <div class="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Preset: <span class="text-blue-600 font-bold text-[9px]">${item.preset}</span></span>
                    <span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black text-[9px]">${item.size}</span>
                </div>
            </div>
        `).join('');
    },

    bindEvents() {
        const overlay = document.getElementById('nav-overlay');
        const sidebar = document.getElementById('nav-sidebar');
        const closeBtn = document.getElementById('close-nav');
        const search = document.getElementById('tool-search');
        const triggers = document.querySelectorAll('.nav-trigger');

        const open = () => {
            overlay.classList.remove('hidden');
            sidebar.classList.remove('-translate-x-full');
            document.body.style.overflow = 'hidden';
            setTimeout(() => search.focus(), 300);
        };

        const close = () => {
            overlay.classList.add('hidden');
            sidebar.classList.add('-translate-x-full');
            document.body.style.overflow = '';
        };

        triggers.forEach(btn => btn.onclick = open);
        overlay.onclick = close;
        closeBtn.onclick = close;
        
        const clearBtn = document.getElementById('clear-history');
        if (clearBtn) clearBtn.onclick = () => HistoryManager.clear();

        search.oninput = (e) => this.renderTools(e.target.value);
        window.addEventListener('historyUpdated', () => this.renderHistory());

        // Global shortcut
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                open();
            }
            if (e.key === 'Escape') close();
        });
    }
};

// Initialize if on a tool page or landing page
document.addEventListener('DOMContentLoaded', () => Navigator.init());