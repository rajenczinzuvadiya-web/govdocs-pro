/**
 * Reusable Image Preview Component
 * Displays image and metadata (Width, Height, Size, Format)
 */
export const ImagePreviewer = {
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div id="preview-container" class="w-full space-y-6">
                <!-- Image Display Area -->
                <div class="preview-box bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex justify-center items-center min-h-[250px] md:min-h-[300px]">
                    <img id="mainCanvas" class="max-w-full shadow-inner" alt="Document Preview">
                </div>

                <!-- Metadata Dashboard -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                        <span class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Width</span>
                        <span id="preview-width" class="text-sm font-bold text-slate-700">0 px</span>
                    </div>
                    <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                        <span class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Height</span>
                        <span id="preview-height" class="text-sm font-bold text-slate-700">0 px</span>
                    </div>
                    <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                        <span class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">File Size</span>
                        <span id="preview-size" class="text-sm font-bold text-slate-700">0 KB</span>
                    </div>
                    <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                        <span class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Format</span>
                        <span id="preview-format" class="text-sm font-bold text-slate-700">N/A</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Future Method Structure for updating metadata
     * @param {Object} data - { width, height, size, format }
     */
    updateMetadata(data) {
        const { width, height, size, format } = data;
        if (document.getElementById('preview-width')) document.getElementById('preview-width').innerText = `${width} px`;
        if (document.getElementById('preview-height')) document.getElementById('preview-height').innerText = `${height} px`;
        if (document.getElementById('preview-size')) document.getElementById('preview-size').innerText = `${size} KB`;
        if (document.getElementById('preview-format')) document.getElementById('preview-format').innerText = format;
    }
};