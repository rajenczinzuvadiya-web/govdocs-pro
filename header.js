/**
 * Header Component - GovDocs Pro
 * Shared header UI for all pages
 */

export const Header = {
    render() {
        const headerHtml = `
            <div class="container mx-auto px-4 h-24 flex items-center justify-between">
                <div class="flex flex-col">
                    <a href="index.html" class="flex items-center gap-2 mb-0.5">
                        <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200">G</div>
                        <h1 class="text-xl font-black tracking-tight text-slate-900 leading-none">GovDocs<span class="text-blue-600">.pro</span></h1>
                    </a>
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-11" data-lang="header_subtitle">સરકારી કામ માટે તમારો વિશ્વસનીય સાથી</span>
                </div>
                <nav class="hidden lg:flex items-center gap-6 text-[13px] font-bold text-slate-600 uppercase tracking-wider">
                    <a href="index.html" class="hover:text-blue-600 transition-colors" data-lang="nav_home">Home</a>
                    <button class="nav-trigger hover:text-blue-600 transition-colors" data-lang="nav_tools">Tools</button>
                    <a href="contact.html" class="hover:text-blue-600 transition-colors" data-lang="nav_contact">Contact</a>
                    <div class="relative" id="lang-switcher-desktop">
                        <button id="lang-switcher-btn" class="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m4 13-4-4-4 4M19 17v-2a4 4 0 00-4-4H9M19 17h-4a4 4 0 00-4 4v2m0-14a4 4 0 00-4-4H5" /></svg>
                            <span id="current-lang-text">GU</span>
                        </button>
                        <div id="lang-dropdown" class="absolute top-full right-0 mt-3 w-32 bg-white rounded-xl shadow-xl border border-slate-100 hidden flex-col overflow-hidden z-50">
                            <button class="lang-option p-3 text-left text-sm font-bold hover:bg-slate-50 transition-colors" data-lang-code="en">English</button>
                            <button class="lang-option p-3 text-left text-sm font-bold hover:bg-slate-50 transition-colors" data-lang-code="gu">ગુજરાતી</button>
                            <button class="lang-option p-3 text-left text-sm font-bold hover:bg-slate-50 transition-colors" data-lang-code="hi">हिन्दी</button>
                        </div>
                    </div>
                </nav>
                <button class="lg:hidden nav-trigger p-2 text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                </button>
            </div>
        `;

        const header = document.getElementById('main-header');
        if (header) header.innerHTML = headerHtml;
    }
};