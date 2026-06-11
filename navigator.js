/**
 * Navigator Component - GovDocs Pro
 * Centralized tool registry and navigation UI
 */
import { HistoryManager } from './history-manager.js';
import { Header } from './header.js';
import { Footer } from './footer.js';
import { LanguageManager } from './language-manager.js';

const TOOLS = [
    { id: 'photo-resize', title: 'Photo Resize', desc: 'Adjust Height/Width', gu: 'ફોટો રીસાઇઝ', cat: '📸 Photo Tools', link: 'photo-resize.html', icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5', key: 'resize image photo size' },
    { id: 'photo-compress', title: 'Photo Compress', desc: 'Reduce File Size (KB)', gu: 'ફોટો કમ્પ્રેસ', cat: '📸 Photo Tools', link: 'photo-compress.html', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3', key: 'compress image photo' },
    { id: '20kb-photo', title: '20KB Compressor', desc: 'Compress photo to exactly 20KB', gu: '૨૦ KB ફોટો કમ્પ્રેસ', cat: '📸 Photo Tools', link: '20kb-photo.html', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4', key: '20kb compress image' },
    { id: 'passport-photo', title: 'Passport Photo Maker', desc: 'Generate Passport Sizes', gu: 'પાસપોર્ટ ફોટો', cat: '📸 Photo Tools', link: 'passport-photo.html', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z', key: 'passport photo' },
    { id: 'signature-resize', title: 'Signature Resize', desc: 'Resize & Transparent BG', gu: 'સહી રીસાઇઝ', cat: '✍️ Signature Tools', link: 'signature-resize.html', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', key: 'sign, png, background, remove' },
    { id: 'jpg-to-pdf', title: 'JPG to PDF', desc: 'Convert images to PDF', gu: 'JPG થી PDF', cat: '📄 PDF Tools', link: 'jpg-to-pdf.html', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', key: 'jpg pdf convert' },
    { id: 'pdf-merge', title: 'PDF Merge', desc: 'Combine multiple PDFs', gu: 'PDF મર્જ', cat: '📄 PDF Tools', link: 'pdf-merge.html', icon: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', key: 'pdf merge combine' },
    { id: 'image-crop', title: 'Image Crop', desc: 'Crop, Rotate, and Adjust', gu: 'ફોટો કાપો', cat: '📸 Photo Tools', link: 'image-crop.html', icon: 'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z', key: 'crop image photo resize passport' },
    { id: 'ssc-preset', title: 'SSC Presets', desc: 'Standard Document Sizes', gu: 'SSC માપદંડ', cat: '📸 Photo Tools', link: 'photo-resize.html', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04', key: 'portal, recruitment' },
    { id: 'pdf-split', title: 'PDF Split', desc: 'Extract or Separate Pages', gu: 'PDF અલગ કરો', cat: '📄 PDF Tools', link: 'pdf-split.html', icon: 'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z', key: 'pdf split extract cut' },
    { id: 'pdf-rotate', title: 'PDF Rotate', desc: 'Rotate PDF pages', gu: 'PDF પેજ ફેરવો', cat: '📄 PDF Tools', link: 'pdf-rotate.html', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', key: 'rotate turn pdf orientation page' },
    { id: 'pdf-compress', title: 'PDF Compress', desc: 'Reduce PDF file size', gu: 'PDF સાઈઝ ઘટાડો', cat: '📄 PDF Tools', link: 'pdf-compress.html', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3', key: 'compress pdf reduce size' },
    { id: 'print-studio', title: 'Document Print Studio', desc: 'Layout & Print ID Cards', gu: 'પ્રિન્ટ સ્ટુડિયો', cat: '📄 PDF Tools', link: 'document-print-studio.html', icon: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z', key: 'aadhaar print, id card print, document print, front back print, election card print, pan card print, passport photo print' },
    { id: 'image-converter', title: 'Image Converter', desc: 'Convert to JPG, PNG, WEBP', gu: 'ઈમેજ કન્વર્ટર', cat: '📸 Photo Tools', link: 'image-converter.html', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', key: 'convert image format jpg png webp' }
];

export const Navigator = {
    currentTextFilter: '',
    currentCategory: 'all',

    async init() {
        Header.render();
        Footer.render();
        await LanguageManager.init();
        this.injectHeaderSearch();
        this.injectSidebar();
        this.renderHistory(); // Render history after sidebar is injected
        this.bindEvents();
    },

    injectHeaderSearch() {
        const header = document.getElementById('main-header');
        if (!header) return;

        // Access the inner container of the header (or fallback to header itself)
        const container = header.querySelector('.container') || header.firstElementChild || header;
        
        const desktopSearchHtml = `
            <div id="header-search-wrapper" class="hidden md:flex items-center flex-1 max-w-[280px] min-w-[220px] mx-4 relative group">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg class="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input type="text" id="header-search-desktop" placeholder="Search tools..." class="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent focus:bg-white rounded-full text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                <div id="header-search-results-desktop" class="absolute top-full mt-2 left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 hidden flex-col overflow-hidden z-50 max-h-80 overflow-y-auto"></div>
            </div>
        `;

        const mobileSearchIconHtml = `
            <div class="md:hidden flex items-center ml-auto mr-2">
                <button id="header-search-icon-mobile" class="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>
        `;

        const mobileSearchFieldHtml = `
            <div id="header-search-field-mobile" class="hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 p-3 shadow-lg z-[60]">
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input type="text" id="header-search-mobile-input" placeholder="Search tools..." class="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <div id="header-search-results-mobile" class="absolute top-full mt-2 left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 hidden flex-col overflow-hidden z-50 max-h-80 overflow-y-auto"></div>
                </div>
            </div>
        `;

        const firstChild = container.firstElementChild; // Targeting location right after the Logo
        if (firstChild) firstChild.insertAdjacentHTML('afterend', desktopSearchHtml);
        else container.insertAdjacentHTML('afterbegin', desktopSearchHtml);

        const lastChild = container.lastElementChild; // Targeting location right before the Navigation
        if (lastChild) lastChild.insertAdjacentHTML('beforebegin', mobileSearchIconHtml);
        else container.insertAdjacentHTML('beforeend', mobileSearchIconHtml);

        header.insertAdjacentHTML('beforeend', mobileSearchFieldHtml);
    },

    injectLangSwitcherMobile() {
        const sidebar = document.getElementById('nav-sidebar');
        if (!sidebar) return;
        const langSwitcherHtml = `
            <div class="p-4 border-t border-slate-100">
                <h3 class="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 px-2">Language</h3>
                <button class="lang-option w-full text-left p-3 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors" data-lang-code="en">English</button>
                <button class="lang-option w-full text-left p-3 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors" data-lang-code="gu">ગુજરાતી</button>
                <button class="lang-option w-full text-left p-3 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors" data-lang-code="hi">हिन्दी</button>
            </div>`;
        sidebar.insertAdjacentHTML('beforeend', langSwitcherHtml);
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

                <div class="flex-1 overflow-y-auto p-4 space-y-5">
                    <div id="sidebar-tools-list" class="space-y-3">
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
        this.injectLangSwitcherMobile();
    },

    renderTools(filter = this.currentTextFilter, category = this.currentCategory) {
        this.currentTextFilter = filter;
        this.currentCategory = category;
        
        const lists = [document.getElementById('tools-list'), document.getElementById('sidebar-tools-list')].filter(Boolean);
        if (lists.length === 0) return;

        const filtered = TOOLS.filter(t => {
            const matchesText = !filter || t.title.toLowerCase().includes(filter.toLowerCase()) || t.gu.includes(filter) || (t.key && t.key.toLowerCase().includes(filter.toLowerCase()));
            let matchesCat = true;
            
            if (category === 'photo') matchesCat = t.cat.includes('Photo');
            else if (category === 'pdf') matchesCat = t.cat.includes('PDF');
            else if (category === 'signature') matchesCat = t.cat.includes('Signature');
            else if (category === 'passport') matchesCat = t.id.includes('passport') || (t.key && t.key.includes('passport'));
            else if (category === 'presets') matchesCat = t.id.includes('preset') || (t.key && t.key.includes('preset'));
            
            return matchesText && matchesCat;
        });

        const html = filtered.map(t => `
            <a href="${t.link}" class="card-interactive flex items-center gap-4 p-4 bg-white border border-slate-200/60 rounded-2xl group shadow-sm h-full">
                <div class="w-10 h-10 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${t.icon}" /></svg>
                </div>
                <div class="min-w-0">
                    <div class="text-sm font-bold text-slate-900 truncate">${t.title}</div>
                    <div class="text-[10px] text-slate-500 font-medium truncate">${t.gu}</div>
                </div>
            </a>
        `).join('');

        const emptyHtml = `<div class="col-span-full text-center py-12 text-slate-400 text-sm">No tools found matching "${filter}"</div>`;
        
        lists.forEach(list => {
            list.innerHTML = filtered.length > 0 ? html : emptyHtml;
        });
    },

    renderDropdownResults(query, container) {
        if (!container) return;
        const val = query.toLowerCase().trim();
        if (!val) {
            container.classList.add('hidden');
            return;
        }

        const matches = TOOLS.filter(t => 
            t.title.toLowerCase().includes(val) || 
            t.gu.includes(val) || 
            (t.key && t.key.toLowerCase().includes(val))
        );

        if (matches.length > 0) {
            container.innerHTML = matches.map(t => `
                <a href="${t.link}" class="flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                    <div class="w-8 h-8 bg-slate-100 text-slate-500 rounded flex items-center justify-center shrink-0">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${t.icon}" /></svg>
                    </div>
                    <div class="min-w-0 text-left">
                        <div class="text-sm font-bold text-slate-900 truncate">${t.title}</div>
                        <div class="text-[10px] text-slate-500 truncate">${t.cat}</div>
                    </div>
                </a>
            `).join('');
        } else {
            container.innerHTML = `<div class="p-4 text-center text-sm text-slate-500">No tools found for "${val}"</div>`;
        }
        container.classList.remove('hidden');
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
        const sidebarSearch = document.getElementById('tool-search');
        const triggers = document.querySelectorAll('.nav-trigger');
        const dInput = document.getElementById('header-search-desktop');
        const dResults = document.getElementById('header-search-results-desktop');
        const mInput = document.getElementById('header-search-mobile-input');
        const mResults = document.getElementById('header-search-results-mobile');
        const mBtn = document.getElementById('header-search-icon-mobile');
        const mField = document.getElementById('header-search-field-mobile');

        const langBtn = document.getElementById('lang-switcher-btn');
        const langDropdown = document.getElementById('lang-dropdown');
        const langOptions = document.querySelectorAll('.lang-option');

        const open = () => {
            overlay.classList.remove('hidden');
            sidebar.classList.remove('-translate-x-full');
            document.body.style.overflow = 'hidden';
            setTimeout(() => sidebarSearch?.focus(), 300);
        };

        const close = () => {
            overlay.classList.add('hidden');
            sidebar.classList.add('-translate-x-full');
            document.body.style.overflow = '';
        };

        const syncSearch = (val) => {
            if (sidebarSearch && sidebarSearch !== document.activeElement) sidebarSearch.value = val;
            if (dInput && dInput !== document.activeElement) dInput.value = val;
            if (mInput && mInput !== document.activeElement) mInput.value = val;
            
            this.renderTools(val, this.currentCategory);
            if (dInput === document.activeElement) this.renderDropdownResults(val, dResults);
            if (mInput === document.activeElement) this.renderDropdownResults(val, mResults);
        };

        triggers.forEach(btn => btn.onclick = open);
        overlay.onclick = close;
        closeBtn.onclick = close;
        
        const clearBtn = document.getElementById('clear-history');
        if (clearBtn) clearBtn.onclick = () => HistoryManager.clear();

        if (sidebarSearch) sidebarSearch.oninput = (e) => syncSearch(e.target.value);
        if (dInput) dInput.oninput = (e) => syncSearch(e.target.value);
        if (mInput) mInput.oninput = (e) => syncSearch(e.target.value);

        if (mBtn && mField) {
            mBtn.onclick = () => {
                mField.classList.toggle('hidden');
                if (!mField.classList.contains('hidden')) mInput.focus();
            };
        }

        document.addEventListener('click', (e) => {
            if (dInput && dResults && !dInput.contains(e.target) && !dResults.contains(e.target)) {
                dResults.classList.add('hidden');
            }
            if (mField && mBtn && !mField.contains(e.target) && !mBtn.contains(e.target)) {
                mField.classList.add('hidden');
                if (mResults) mResults.classList.add('hidden');
            }
            // Close lang dropdown
            if (langBtn && langDropdown && !langBtn.contains(e.target) && !langDropdown.contains(e.target)) {
                langDropdown.classList.add('hidden');
            }
        });

        if (dInput) dInput.addEventListener('focus', (e) => {
            if (e.target.value.trim()) this.renderDropdownResults(e.target.value, dResults);
        });

        const handleEnter = (e, resultsContainer) => {
            if (e.key === 'Enter' && resultsContainer && !resultsContainer.classList.contains('hidden')) {
                const firstLink = resultsContainer.querySelector('a');
                if (firstLink) firstLink.click();
            }
        };
        
        if (dInput) dInput.addEventListener('keydown', (e) => handleEnter(e, dResults));
        if (mInput) mInput.addEventListener('keydown', (e) => handleEnter(e, mResults));

        // Pill Navigation Filter Logic
        const filterPills = document.querySelectorAll('.filter-pill');
        const toolsListContainer = document.getElementById('tools-list');

        if (filterPills.length > 0 && toolsListContainer) {
            toolsListContainer.style.transition = 'opacity 200ms ease-in-out';
            
            filterPills.forEach(pill => {
                pill.addEventListener('click', (e) => {
                    const target = e.currentTarget;
                    if (target.classList.contains('active')) return;

                    filterPills.forEach(p => {
                        p.classList.remove('bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-200', 'active', 'border-transparent');
                        p.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
                    });
                    target.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
                    target.classList.add('bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-200', 'active', 'border-transparent');

                    toolsListContainer.style.opacity = '0';
                    setTimeout(() => {
                        this.renderTools(this.currentTextFilter, target.dataset.filter);
                        toolsListContainer.style.opacity = '1';
                    }, 200);
                });
            });
        }

        window.addEventListener('historyUpdated', () => this.renderHistory());

        // Sticky header scroll effect
        const header = document.getElementById('main-header');
        if (header) {
            window.addEventListener('scroll', () => {
                header.classList.toggle('header-scrolled', window.scrollY > 0);
            }, { passive: true });
        }

        // Global shortcut
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                open();
            }
            if (e.key === 'Escape') {
                close();
                syncSearch('');
            }
        });

        // Language Switcher Logic
        if (langBtn && langDropdown) {
            langBtn.addEventListener('click', () => {
                const isHidden = langDropdown.classList.toggle('hidden');
                langBtn.setAttribute('aria-expanded', !isHidden);
            });
        }

        langOptions.forEach(option => {
            option.addEventListener('click', async (e) => {
                const langCode = e.currentTarget.dataset.langCode;
                await LanguageManager.setLanguage(langCode);
                document.getElementById('current-lang-text').textContent = langCode.toUpperCase();
                langDropdown?.classList.add('hidden');
                if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
                close(); // Close sidebar if open
            });
        });
    }
};

// Initialize if on a tool page or landing page
document.addEventListener('DOMContentLoaded', () => {
    Navigator.init();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('ServiceWorker registration successful with scope:', reg.scope))
            .catch(err => console.error('ServiceWorker registration failed:', err));
    }
});