/**
 * Header Component - GovDocs Pro
 * Shared header UI for all pages
 */

export const Header = {
    render() {
        const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
        
        const headerHtml = `
            <div class="container mx-auto px-4 h-20 flex items-center justify-between">
                <a href="index.html" class="flex items-center gap-2">
                    <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200">G</div>
                    <h1 class="text-2xl font-black tracking-tight text-slate-900">GovDocs<span class="text-blue-600">.pro</span></h1>
                </a>
                <nav class="hidden lg:flex items-center gap-10 text-sm font-semibold text-slate-600 uppercase tracking-widest">
                    <a href="index.html" class="hover:text-blue-600 transition-colors">Home</a>
                    <button class="nav-trigger flex items-center gap-2 hover:text-blue-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                        Tools
                    </button>
                    <a href="index.html#govt-services" class="hover:text-blue-600 transition-colors">Presets</a>
                    <div class="h-6 w-px bg-slate-200"></div>
                    <span class="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-400 font-medium">Ctrl+K to search</span>
                </nav>
            </div>
        `;

        const header = document.getElementById('main-header');
        if (header) header.innerHTML = headerHtml;
    }
};