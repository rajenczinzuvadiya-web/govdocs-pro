/**
 * Footer Component - GovDocs Pro
 */
export const Footer = {
    render() {
        const footer = document.getElementById('footer');
        if (!footer) return;

        footer.innerHTML = `
        <div class="container mx-auto px-4 max-w-6xl">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 mb-6 md:mb-10 text-center md:text-left">
                <div class="flex flex-col items-center md:items-start space-y-4">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white font-black text-xs">G</div>
                        <span class="text-lg font-black tracking-tight text-white">GovDocs<span class="text-blue-500">.pro</span></span>
                    </div>
                    <p class="text-sm leading-relaxed max-w-xs">સરકારી ફોર્મ માટે ફોટો, PDF અને ડોક્યુમેન્ટ ટૂલ્સ.</p>
                    <p class="text-[11px] font-medium text-slate-500">Made in Gujarat ❤️</p>
                </div>
                <div class="space-y-4">
                    <h4 class="text-white font-bold text-xs uppercase tracking-widest">Quick Links</h4>
                    <ul class="text-sm space-y-2.5">
                        <li><a href="index.html" class="hover:text-white transition-colors">Home</a></li>
                        <li><a href="photo-resize.html" class="hover:text-white transition-colors">Photo Resize</a></li>
                        <li><a href="photo-compress.html" class="hover:text-white transition-colors">Photo Compress</a></li>
                        <li><a href="jpg-to-pdf.html" class="hover:text-white transition-colors">JPG to PDF</a></li>
                        <li><a href="pdf-merge.html" class="hover:text-white transition-colors">PDF Merge</a></li>
                    </ul>
                </div>
                <div class="space-y-4">
                    <h4 class="text-white font-bold text-xs uppercase tracking-widest">Legal</h4>
                    <ul class="text-sm space-y-2.5">
                        <li><a href="privacy-policy.html" class="hover:text-white transition-colors">Privacy Policy</a></li>
                        <li><a href="terms.html" class="hover:text-white transition-colors">Terms of Service</a></li>
                        <li><a href="contact.html" class="hover:text-white transition-colors">Contact Us</a></li>
                    </ul>
                </div>
            </div>
            <div class="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-slate-500">
                <p>© 2025 GovDocs Pro. All Rights Reserved.</p>
                <p class="bg-slate-800/50 px-2 py-1 rounded">Version: v1.0</p>
            </div>
        </div>`;
    }
};