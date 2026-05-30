/**
 * Reusable Image Upload Component
 * Supports Click and Drag & Drop
 */
export const ImageUploader = {
    render: (containerId, onImageLoaded) => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`ImageUploader: Container with ID '${containerId}' not found.`);
            return;
        }

        container.innerHTML = `
            <div id="drop-zone" class="group relative p-8 md:p-10 border-2 border-dashed border-slate-300 rounded-3xl bg-white hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer text-center">
                <input type="file" id="imageInput" accept="image/*" class="hidden">
                <div class="flex flex-col items-center">
                    <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg shadow-blue-100">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p class="text-slate-900 font-bold text-lg mb-1">ફોટો પસંદ કરો</p>
                    <p class="hidden md:block text-slate-400 text-sm mb-2">અથવા અહીં ખેંચો</p>
                    <p class="text-slate-500 text-xs uppercase tracking-widest font-bold">JPG, PNG સપોર્ટેડ છે</p>
                </div>
            </div>
        `;

        const dropZone = container.querySelector('#drop-zone');
        const fileInput = container.querySelector('#imageInput');

        const processFile = (file) => {
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => onImageLoaded(e.target.result);
                reader.readAsDataURL(file);
            }
        };

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => processFile(e.target.files[0]);

        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); };
        dropZone.ondragleave = () => { dropZone.classList.remove('border-blue-500', 'bg-blue-50'); };
        dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('border-blue-500', 'bg-blue-50'); processFile(e.dataTransfer.files[0]); };
    }
};