import { GOVT_PRESETS } from './govt_presets.js';
import { mergePDFs, convertImagesToPdf, splitPdfByRange, splitPdfToZip, rotatePdfPages } from './pdf-logic.js';
import * as Engine from './image-engine.js';
import { ImageUploader } from './image-uploader.js';
import { ImagePreviewer } from './image-previewer.js';
import { HistoryManager } from './history-manager.js';

const state = {
    originalImage: null,
    cropper: null,
    bgColor: 'original',
    isTransparent: false,
    isBlackAndWhite: false,
    whiteBg: false,
    originalSizeKb: 0,
    mimeType: null
};

const updateStatus = (msg, type = 'ready') => {
    const statusContainer = document.getElementById('statusContainer') || document.getElementById('pdfStatusContainer') || document.getElementById('splitStatusContainer') || document.getElementById('rotateStatusContainer');
    const statusMsg = document.getElementById('statusMsg') || document.getElementById('pdfStatus') || document.getElementById('splitStatusMsg') || document.getElementById('rotateStatusMsg');
    if (statusMsg) statusMsg.innerText = msg;
    
    if (statusContainer) {
        statusContainer.classList.remove('status-ready', 'status-processing', 'status-success', 'status-error');
        statusContainer.classList.add(`status-${type}`);
    }
};

/**
 * Core One-Click Processing Engine
 * Automates resize, compression, and download based on Preset System
 */
async function runQuickProcess(presetKey, type) {
    if (!state.cropper) return;
    const preset = GOVT_PRESETS[presetKey];
    if (!preset) return;

    const config = type === 'signature' ? preset.signature : preset.photo;
    updateStatus(`${preset.label} મોડ: પ્રોસેસિંગ ચાલુ છે...`, 'processing');

    // 1. Sync the Manual/Preset UI (Optional but good for UX)
    const presetSelect = document.getElementById('presetSelect');
    if (presetSelect) {
        presetSelect.value = presetKey;
        presetSelect.dispatchEvent(new Event('change'));
    }

    // 2. Perform automated resize based on preset dimensions
    const canvas = state.cropper.getCroppedCanvas({
        width: config.width,
        height: config.height
    });

    // 3. Compress using the target KB range defined in govt_presets.js
    const blob = await Engine.compressToTargetKB(canvas, config.minKb, config.maxKb);
    
    // 4. Update the preview and metadata display
    const reader = new FileReader();
    reader.onload = (e) => {
        state.cropper.replace(e.target.result);
        ImagePreviewer.updateMetadata({
            width: config.width,
            height: config.height,
            size: Math.round(blob.size / 1024),
            format: 'JPEG'
        });

        // 5. Trigger immediate download for One-Click experience
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${presetKey}_${type}_ready.jpg`;
        link.click();
        
        HistoryManager.save({
            toolName: type === 'signature' ? 'Signature Resize' : 'Photo Resize',
            preset: preset.label,
            size: `${Math.round(blob.size / 1024)} KB`
        });

        updateStatus(`${preset.label} ફાઇલ તૈયાર છે!`, 'success');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    reader.readAsDataURL(blob);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize Common Preview Component ---
    if (document.getElementById('image-preview-container')) {
        ImagePreviewer.render('image-preview-container');
    }

    // --- Initialize Common Upload Component ---
    const presetSelect = document.getElementById('presetSelect');
    const statusMsg = document.getElementById('statusMsg');
    const previewArea = document.getElementById('previewArea');
    const brightnessInput = document.getElementById('brightnessInput');
    const contrastInput = document.getElementById('contrastInput');
    const manualWidth = document.getElementById('manualWidth');
    const manualHeight = document.getElementById('manualHeight');
    const jpgInput = document.getElementById('jpgToPdfInput');
    const jpgListSection = document.getElementById('list-section');
    const jpgListContainer = document.getElementById('image-list-container');
    const pdfMergeInput = document.getElementById('mergePdfInput');
    const pdfListSection = document.getElementById('pdf-list-section');
    const pdfListContainer = document.getElementById('pdf-list-container');

    let selectedJpgFiles = [];
    let selectedPdfFiles = [];

    const renderPdfList = () => {
        if (!pdfListContainer || !pdfListSection) return;
        if (selectedPdfFiles.length === 0) {
            pdfListSection.classList.add('hidden');
            return;
        }
        pdfListSection.classList.remove('hidden');
        pdfListContainer.innerHTML = selectedPdfFiles.map((file, index) => `
            <div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div class="text-sm font-bold text-slate-700 truncate max-w-[200px]">${file.name}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button class="pdf-move-up p-2 text-slate-400 hover:text-blue-600 ${index === 0 ? 'invisible' : ''}" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button class="pdf-move-down p-2 text-slate-400 hover:text-blue-600 ${index === selectedPdfFiles.length - 1 ? 'invisible' : ''}" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button class="pdf-remove p-2 text-slate-400 hover:text-red-600" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
        `).join('');

        pdfListContainer.querySelectorAll('.pdf-move-up').forEach(btn => btn.onclick = () => {
            const i = parseInt(btn.dataset.index);
            [selectedPdfFiles[i], selectedPdfFiles[i-1]] = [selectedPdfFiles[i-1], selectedPdfFiles[i]];
            renderPdfList();
        });
        pdfListContainer.querySelectorAll('.pdf-move-down').forEach(btn => btn.onclick = () => {
            const i = parseInt(btn.dataset.index);
            [selectedPdfFiles[i], selectedPdfFiles[i+1]] = [selectedPdfFiles[i+1], selectedPdfFiles[i]];
            renderPdfList();
        });
        pdfListContainer.querySelectorAll('.pdf-remove').forEach(btn => btn.onclick = () => {
            const i = parseInt(btn.dataset.index);
            selectedPdfFiles.splice(i, 1);
            renderPdfList();
        });
    };

    const handlePdfFiles = (files) => {
        Array.from(files).forEach(file => {
            if (file.type === 'application/pdf') selectedPdfFiles.push(file);
        });
        renderPdfList();
    };

    const renderJpgList = () => {
        if (!jpgListContainer || !jpgListSection) return;
        
        const uploadSection = document.getElementById('upload-section');
        const previewArea = document.getElementById('previewArea');

        if (selectedJpgFiles.length === 0) {
            if (previewArea) previewArea.classList.add('hidden');
            if (uploadSection) uploadSection.classList.remove('hidden');
            jpgListSection.classList.add('hidden');
            return;
        }
        
        jpgListSection.classList.remove('hidden');
        if (uploadSection) uploadSection.classList.add('hidden');
        if (previewArea) previewArea.classList.remove('hidden');

        // Update Stats
        const imgCount = document.getElementById('img-count-display');
        const pageCount = document.getElementById('page-count-display');
        if (imgCount) imgCount.innerText = selectedJpgFiles.length;
        if (pageCount) pageCount.innerText = selectedJpgFiles.length;

        jpgListContainer.innerHTML = selectedJpgFiles.map((item, index) => `
            <div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                        <img src="${item.preview}" class="w-full h-full object-cover" alt="Thumb">
                    </div>
                    <div class="text-sm font-bold text-slate-700 truncate max-w-[150px]">${item.file.name}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button class="move-up-btn p-2 text-slate-400 hover:text-blue-600 ${index === 0 ? 'invisible' : ''}" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button class="move-down-btn p-2 text-slate-400 hover:text-blue-600 ${index === selectedJpgFiles.length - 1 ? 'invisible' : ''}" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button class="remove-btn p-2 text-slate-400 hover:text-red-600" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
        `).join('');

        jpgListContainer.querySelectorAll('.move-up-btn').forEach(btn => {
            btn.onclick = () => {
                const i = parseInt(btn.dataset.index);
                [selectedJpgFiles[i], selectedJpgFiles[i-1]] = [selectedJpgFiles[i-1], selectedJpgFiles[i]];
                renderJpgList();
            };
        });
        jpgListContainer.querySelectorAll('.move-down-btn').forEach(btn => {
            btn.onclick = () => {
                const i = parseInt(btn.dataset.index);
                [selectedJpgFiles[i], selectedJpgFiles[i+1]] = [selectedJpgFiles[i+1], selectedJpgFiles[i]];
                renderJpgList();
            };
        });
        jpgListContainer.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = () => {
                const i = parseInt(btn.dataset.index);
                URL.revokeObjectURL(selectedJpgFiles[i].preview);
                selectedJpgFiles.splice(i, 1);
                renderJpgList();
            };
        });
    };

    const handleJpgFiles = (files) => {
        let hasInvalidFile = false;
        Array.from(files).forEach(file => {
            if (file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png') {
                selectedJpgFiles.push({ file, preview: URL.createObjectURL(file) });
            } else {
                hasInvalidFile = true;
            }
        });
        if (hasInvalidFile) {
            alert("Only JPG and PNG images are supported.");
        }
        renderJpgList();
    };

    // Populate Preset Select dynamically from centralized engine
    if (presetSelect) {
        Object.entries(GOVT_PRESETS).forEach(([key, preset]) => {
            if (!presetSelect.querySelector(`option[value="${key}"]`)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = preset.label;
                presetSelect.appendChild(option);
            }
        });

        // Determine context (Signature vs Photo)
        const isSignaturePage = !!document.getElementById('downloadSign');
        const toolType = isSignaturePage ? 'signature' : 'photo';
        presetSelect.setAttribute('data-tool-type', toolType);
    }

    if (document.getElementById('image-upload-container')) {
        ImageUploader.render('image-upload-container', (imageSrc) => {
            if (state.cropper) state.cropper.destroy();
            
            const img = new Image();
            img.onload = () => {
                state.originalImage = img;
                
                // Show the workspace
                if (previewArea) previewArea.classList.remove('hidden');
                
                // Hide upload section to reduce scrolling
                const uploadSection = document.getElementById('upload-section');
                if (uploadSection) uploadSection.classList.add('hidden');

                // Set natural dimensions as defaults for manual inputs if empty (useful for compression tool)
                if (manualWidth && !manualWidth.value) manualWidth.value = img.naturalWidth;
                if (manualHeight && !manualHeight.value) manualHeight.value = img.naturalHeight;

                // Update Metadata Labels
                const sizeInKb = Math.round((imageSrc.length * 0.75) / 1024);
                const mimeTypeMatch = imageSrc.match(/^data:(.*?);/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
                const format = mimeType.split('/')[1].toUpperCase();
                
                state.originalSizeKb = sizeInKb;
                state.mimeType = mimeType;
                
                // Initialize Stats Display
                const originalDisplay = document.getElementById('original-size-display');
                if (originalDisplay) originalDisplay.innerText = sizeInKb + ' KB';
                const compressedDisplay = document.getElementById('compressed-size-display');
                if (compressedDisplay) compressedDisplay.innerText = '-- KB';
                const savedDisplay = document.getElementById('saved-percent-display');
                if (savedDisplay) savedDisplay.innerText = '--%';

                ImagePreviewer.updateMetadata({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    size: sizeInKb,
                    format: format
                });
                
                // Dispatch event for specialized tool pages (like 20KB compressor)
                window.dispatchEvent(new CustomEvent('imageUploaded', { detail: { size: sizeInKb } }));

                renderPreview(img);
                updateStatus("ફાઇલ અપલોડ થઈ ગઈ છે. હવે ડાઉનલોડ બટન પર ક્લિક કરો.");
            };
            img.src = imageSrc;
        });
    }

    // --- PDF Tools Drag & Drop ---
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        const isPdfMerge = !!document.getElementById('mergePdfBtn');
        const isJpgToPdf = !!document.getElementById('convertJpgBtn') && !isPdfMerge;
        const isPdfSplit = !!document.getElementById('splitPdfBtn');
        const isPdfRotate = !!document.getElementById('rotatePdfActionBtn');

        if (isPdfSplit) {
            const splitInput = document.getElementById('splitPdfInput');
            if (splitInput) {
                dropZone.onclick = () => splitInput.click();
                dropZone.ondrop = (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('bg-blue-50');
                    if (e.dataTransfer.files[0]) handlePdfSplitFile(e.dataTransfer.files[0]);
                };
                splitInput.onchange = (e) => {
                    if (e.target.files[0]) handlePdfSplitFile(e.target.files[0]);
                };
            }
        } else if (isPdfRotate) {
            const rotateInput = document.getElementById('rotatePdfInput');
            if (rotateInput) {
                dropZone.onclick = () => rotateInput.click();
                dropZone.ondrop = (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('bg-blue-50');
                    if (e.dataTransfer.files[0]) handlePdfRotateFile(e.dataTransfer.files[0]);
                };
                rotateInput.onchange = (e) => {
                    if (e.target.files[0]) handlePdfRotateFile(e.target.files[0]);
                };
            }
        } else if (isPdfMerge && pdfMergeInput) {
            dropZone.onclick = () => pdfMergeInput.click();
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('bg-blue-50');
                handlePdfFiles(e.dataTransfer.files);
            };
            pdfMergeInput.onchange = (e) => {
                handlePdfFiles(e.target.files);
                e.target.value = '';
            };
            document.getElementById('addMorePdfBtn')?.addEventListener('click', () => pdfMergeInput.click());
        } else if (isJpgToPdf && jpgInput) {
            dropZone.onclick = () => jpgInput.click();
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('bg-blue-50');
                handleJpgFiles(e.dataTransfer.files);
            };
            jpgInput.onchange = (e) => {
                handleJpgFiles(e.target.files);
                e.target.value = '';
            };
            document.getElementById('addMoreBtn')?.addEventListener('click', () => jpgInput.click());
            document.getElementById('add-more-link')?.addEventListener('click', () => jpgInput.click());
        }
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('bg-blue-50'); };
        dropZone.ondragleave = () => dropZone.classList.remove('bg-blue-50');
    }

    // --- Photo Resize Tool: Apply Resize Logic ---
    const applyResizeBtn = document.getElementById('applyResize');
    if (applyResizeBtn) {
        applyResizeBtn.onclick = () => {
            if (!state.cropper || !state.originalImage) return;

            const width = parseInt(manualWidth?.value);
            const height = parseInt(manualHeight?.value);

            if (!width || !height || width <= 0 || height <= 0) {
                updateStatus("કૃપા કરીને સાચું માપ (પહોળાઈ અને ઊંચાઈ) દાખલ કરો.", 'error');
                return;
            }

            // Resize image using Canvas API (via our Engine helper)
            const croppedCanvas = state.cropper.getCroppedCanvas();
            const resizedCanvas = Engine.resizeImage(croppedCanvas, width, height);
            const resizedDataUrl = resizedCanvas.toDataURL('image/jpeg');
            
            // Show resized image in preview area by replacing cropper source
            state.cropper.replace(resizedDataUrl);

            // Update displayed width and height in metadata dashboard
            const sizeInKb = Math.round((resizedDataUrl.length * 0.75) / 1024);
            ImagePreviewer.updateMetadata({ width, height, size: sizeInKb, format: 'JPEG' });
            
            updateStatus(`ઇમેજ સફળતાપૂર્વક ${width}x${height} માં રીસાઇઝ થઈ ગઈ છે.`, 'success');
        };
    }

    // --- Photo Compress Tool: Preset Logic ---
    document.querySelectorAll('.compress-preset').forEach(btn => {
        btn.onclick = () => {
            const targetSizeInput = document.getElementById('targetSize');
            if (targetSizeInput) targetSizeInput.value = btn.getAttribute('data-kb');
        };
    });

    // --- Photo Compress Tool: Apply Compression UI Logic ---
    const applyCompressBtn = document.getElementById('applyCompress');
    if (applyCompressBtn) {
        applyCompressBtn.onclick = async () => {
            if (!state.cropper || !state.originalImage) return;
            
            const targetKbInput = document.getElementById('targetSize');
            const targetKb = parseInt(targetKbInput?.value);

            if (!targetKb || targetKb <= 0) {
                updateStatus("કૃપા કરીને સાચું માપ (KB) દાખલ કરો.");
                return;
            }

            updateStatus(`ઇમેજને ${targetKb} KB માં કમ્પ્રેસ કરી રહ્યા છીએ...`, 'processing');

            // Get current cropped area as canvas (width/height unchanged)
            const croppedCanvas = state.cropper.getCroppedCanvas();
            
            // Compression range: target is max, allow a small buffer for min
            const maxKb = targetKb;
            const minKb = Math.max(1, targetKb - 5);

            const blob = await Engine.compressToTargetKB(croppedCanvas, minKb, maxKb, 'image/jpeg');

            const reader = new FileReader();
            reader.onload = (e) => {
                const compressedDataUrl = e.target.result;
                
                // Update the cropper with the compressed version
                state.cropper.replace(compressedDataUrl);

                // Update Metadata Display
                const sizeInKb = Math.round(blob.size / 1024);
                ImagePreviewer.updateMetadata({
                    width: croppedCanvas.width,
                    height: croppedCanvas.height,
                    size: sizeInKb,
                    format: 'JPEG'
                });

                // Dispatch event for specialized tool pages
                window.dispatchEvent(new CustomEvent('imageCompressed', { detail: { size: sizeInKb } }));

                updateStatus(`સફળતાપૂર્વક કમ્પ્રેસ થયું! નવી સાઈઝ: ${sizeInKb} KB`);
            };
            reader.readAsDataURL(blob);
        };
    }

// Update aspect ratio when preset changes
if (presetSelect) presetSelect.addEventListener('change', () => {
    const val = presetSelect.value;
    const type = presetSelect.getAttribute('data-tool-type') || 'photo';
    
    if (val === 'custom') {
        if (state.cropper) state.cropper.setAspectRatio(NaN);
        return;
    }

    const preset = GOVT_PRESETS[val];
    if (preset) {
        const config = preset[type];
        
        // Auto-fill dimensions
        if (manualWidth) manualWidth.value = config.width;
        if (manualHeight) manualHeight.value = config.height;
        
        // Auto-fill target KB for compression tool
        const targetSizeInput = document.getElementById('targetSize');
        if (targetSizeInput) targetSizeInput.value = config.maxKb;

        if (state.cropper) {
            state.cropper.setAspectRatio(config.width / config.height);
        }
    }
});

// Listen for filter changes
[brightnessInput, contrastInput].forEach(input => {
    input?.addEventListener('input', () => {
        if (state.cropper) {
            const imgElement = document.querySelector('.cropper-view-box img');
            if (imgElement) {
                imgElement.style.filter = `brightness(${brightnessInput.value}%) contrast(${contrastInput.value}%)`;
            }
        }
    });
});

function renderPreview(img) {
    const canvas = document.getElementById('mainCanvas');
    if (!canvas || !presetSelect) return;

    canvas.src = img.src;

    let aspectRatio = NaN;
    const preset = GOVT_PRESETS[presetSelect.value];

    if (preset && manualWidth && manualHeight) {
        aspectRatio = preset.photo.width / preset.photo.height;
        manualWidth.value = preset.photo.width;
        manualHeight.value = preset.photo.height;
    }

    state.cropper = new Cropper(canvas, {
        aspectRatio: aspectRatio,
        viewMode: 1,
        autoCropArea: 0.8, // Centers the crop box slightly within the image
    });
}

async function downloadAdjusted(type) {
    if (!state.originalImage) return;

    const presetSelect = document.getElementById('presetSelect');
    const manualWidth = document.getElementById('manualWidth');
    const manualHeight = document.getElementById('manualHeight');
    const brightnessInput = document.getElementById('brightnessInput');
    const contrastInput = document.getElementById('contrastInput');
    const targetSizeInput = document.getElementById('targetSize');

    let targetWidth, targetHeight, minKb, maxKb;

    if (!presetSelect || presetSelect.value === 'custom') {
        targetWidth = parseInt(manualWidth?.value) || state.originalImage.naturalWidth;
        targetHeight = parseInt(manualHeight?.value) || state.originalImage.naturalHeight;
        
        // Handle compression target size for custom settings if the input exists
        maxKb = targetSizeInput ? parseInt(targetSizeInput.value) : 100;
        minKb = Math.max(5, maxKb - 20); // Basic range buffer for the engine
    } else {
        const preset = GOVT_PRESETS[presetSelect.value];
        const config = type === 'photo' ? preset.photo : preset.signature;
        targetWidth = config.width;
        targetHeight = config.height;
        minKb = config.minKb;
        maxKb = config.maxKb;
    }

    // Get raw cropped canvas from user selection
    let sourceCanvas = state.cropper.getCroppedCanvas();

    // Auto Crop Whitespace (Signature isolation logic)
    const autoCropCheck = document.getElementById('autoCrop');
    if (autoCropCheck && autoCropCheck.checked) {
        sourceCanvas = Engine.autoCropWhitespace(sourceCanvas);
    }

    // Resize isolating area to exact target dimensions
    const resizedCanvas = Engine.resizeImage(sourceCanvas, targetWidth, targetHeight);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    const fCtx = finalCanvas.getContext('2d');

    // Check for explicit white background override (common in Passport tool)
    let bgColor = state.bgColor;
    const whiteBgCheck = document.getElementById('whiteBg') || document.getElementById('whiteBgCheck');
    if (whiteBgCheck && whiteBgCheck.checked) bgColor = 'white';

    if (bgColor !== 'original') {
        fCtx.fillStyle = bgColor;
        fCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    }

    Engine.applyFilters(fCtx, {
        brightness: brightnessInput?.value || 100,
        contrast: contrastInput?.value || 100,
        isBlackAndWhite: type === 'sign' && state.isBlackAndWhite
    });
    
    fCtx.drawImage(resizedCanvas, 0, 0);

    updateStatus("પ્રોસેસિંગ ચાલુ છે...", 'processing');
    const format = (type === 'sign' && state.isTransparent) ? 'image/png' : 'image/jpeg';
    const blob = await Engine.compressToTargetKB(finalCanvas, minKb, maxKb, format);
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const extension = format === 'image/png' ? 'png' : 'jpg';
    link.download = `${presetSelect?.value || 'custom'}_${type}_${Math.round(blob.size/1024)}kb.${extension}`;
    link.click();

    HistoryManager.save({
        toolName: type === 'sign' ? 'Signature Resize' : 'Photo Resize',
        preset: (!presetSelect || presetSelect.value === 'custom') ? 'Custom' : GOVT_PRESETS[presetSelect.value]?.label,
        size: `${Math.round(blob.size/1024)} KB`
    });

    updateStatus(`સફળતાપૂર્વક ડાઉનલોડ થયું! સાઈઝ: ${Math.round(blob.size/1024)} KB`, 'success');
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return finalCanvas;
}

async function generatePrintSheet() {
    const photoCanvas = await downloadAdjusted('photo');
    if (!photoCanvas) return;
    updateStatus("પ્રિન્ટ શીટ બનાવી રહ્યા છીએ...", 'processing');
    await Engine.createPrintSheet(photoCanvas);
    updateStatus("પ્રિન્ટ શીટ તૈયાર છે!", 'success');
}

document.querySelectorAll('[data-color]').forEach(btn => {
    btn.onclick = () => {
        state.bgColor = btn.getAttribute('data-color');
        updateStatus(`Background Color set to: ${state.bgColor === 'original' ? 'None' : state.bgColor}`);
    };
});

document.getElementById('transparentSign')?.addEventListener('change', (e) => state.isTransparent = e.target.checked);
document.getElementById('blackSign')?.addEventListener('change', (e) => state.isBlackAndWhite = e.target.checked);

const printBtn = document.getElementById('printSheet');
if (printBtn) printBtn.onclick = generatePrintSheet;

const downloadPhotoBtn = document.getElementById('downloadPhoto');
if (downloadPhotoBtn) downloadPhotoBtn.onclick = () => downloadAdjusted('photo');

const downloadSignBtn = document.getElementById('downloadSign');
if (downloadSignBtn) downloadSignBtn.onclick = () => downloadAdjusted('sign');

// --- PDF Tools Event Handlers ---

const pdfStatus = document.getElementById('pdfStatus');

const downloadFile = (data, name, type) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
};

document.getElementById('convertJpgBtn')?.addEventListener('click', async () => {
    if (selectedJpgFiles.length === 0) return alert("કૃપા કરીને ઈમેજીસ પસંદ કરો");
    
    updateStatus("PDF બનાવી રહ્યા છીએ...", 'processing');
    try {
        const pdfBytes = await convertImagesToPdf(selectedJpgFiles.map(i => i.file));
        downloadFile(pdfBytes, 'images_converted.pdf', 'application/pdf');
        
        HistoryManager.save({
            toolName: 'JPG to PDF',
            preset: 'N/A',
            size: `${Math.round(pdfBytes.length / 1024)} KB`
        });

        updateStatus("PDF સફળતાપૂર્વક ડાઉનલોડ થઈ ગઈ!", 'success');
    } catch (e) { updateStatus("ભૂલ આવી: " + e.message, 'error'); }
});

document.getElementById('mergePdfBtn')?.addEventListener('click', async () => {
    if (selectedPdfFiles.length < 2) return alert("મર્જ કરવા માટે ઓછામાં ઓછી 2 PDF પસંદ કરો");
    
    updateStatus("PDF મર્જ કરી રહ્યા છીએ...", 'processing');
    try {
        const pdfBytes = await mergePDFs(selectedPdfFiles);
        downloadFile(pdfBytes, 'merged_document.pdf', 'application/pdf');

        HistoryManager.save({
            toolName: 'PDF Merge',
            preset: 'N/A',
            size: `${Math.round(pdfBytes.length / 1024)} KB`
        });

        updateStatus("PDF સફળતાપૂર્વક મર્જ થઈ ગઈ!", 'success');
    } catch (e) { updateStatus("ભૂલ આવી: " + e.message, 'error'); }
});

    // --- PDF Split Specific Logic ---
    let currentSplitFile = null;
    let currentSplitPageCount = 0;
    let splitResultUrl = null;

    const handlePdfSplitFile = async (file) => {
        if (file.type !== 'application/pdf') return alert("માત્ર PDF ફાઇલ માન્ય છે.");
        currentSplitFile = file;
        
        // Parse total pages
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        currentSplitPageCount = pdfDoc.getPageCount();

        // Update UI
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('file-info-section').classList.remove('hidden');
        document.getElementById('split-workspace').classList.remove('hidden');
        document.getElementById('split-file-name').innerText = file.name;
        document.getElementById('split-page-count').innerText = currentSplitPageCount;
        
        if (splitResultUrl) {
            URL.revokeObjectURL(splitResultUrl);
            splitResultUrl = null;
            document.getElementById('downloadSplitBtn').classList.add('hidden');
        }
        updateStatus("ફાઇલ તૈયાર છે. વિકલ્પો પસંદ કરો.", 'ready');
    };

    document.getElementById('change-pdf-btn')?.addEventListener('click', () => {
        document.getElementById('splitPdfInput')?.click();
    });

    // Toggle Range input visibility based on radio selection
    document.querySelectorAll('input[name="splitMode"]')?.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const rangeContainer = document.getElementById('range-input-container');
            if (e.target.value === 'range') {
                rangeContainer.classList.remove('hidden');
            } else {
                rangeContainer.classList.add('hidden');
            }
        });
    });

    const parseRangeString = (str, maxPages) => {
        const pages = new Set();
        const parts = str.split(',');
        for (let part of parts) {
            part = part.trim();
            if (!part) continue;
            if (part.includes('-')) {
                let [start, end] = part.split('-').map(Number);
                if (isNaN(start) || isNaN(end) || start < 1 || end > maxPages || start > end) return null;
                for (let i = start; i <= end; i++) pages.add(i - 1);
            } else {
                let num = Number(part);
                if (isNaN(num) || num < 1 || num > maxPages) return null;
                pages.add(num - 1);
            }
        }
        return Array.from(pages).sort((a, b) => a - b);
    };

    document.getElementById('splitPdfBtn')?.addEventListener('click', async () => {
        if (!currentSplitFile || currentSplitPageCount === 0) return;
        
        const mode = document.querySelector('input[name="splitMode"]:checked').value;
        const dlBtn = document.getElementById('downloadSplitBtn');
        dlBtn.classList.add('hidden');
        
        try {
            if (mode === 'range') {
                const rangeStr = document.getElementById('splitRangeInput').value;
                const pageIndices = parseRangeString(rangeStr, currentSplitPageCount);
                
                if (!pageIndices || pageIndices.length === 0) {
                    return updateStatus("અમાન્ય પેજ રેન્જ! કૃપા કરીને 1 થી " + currentSplitPageCount + " ની વચ્ચે યોગ્ય રેન્જ દાખલ કરો.", 'error');
                }
                
                updateStatus("પેજ અલગ કરી રહ્યા છીએ...", 'processing');
                const pdfBytes = await splitPdfByRange(currentSplitFile, pageIndices);
                
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                splitResultUrl = URL.createObjectURL(blob);
                
                dlBtn.innerText = "Download PDF";
                dlBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = splitResultUrl;
                    a.download = currentSplitFile.name.replace('.pdf', '_split.pdf');
                    a.click();
                };
                
                HistoryManager.save({ toolName: 'PDF Split', preset: 'Custom Range', size: `${Math.round(blob.size / 1024)} KB` });
                updateStatus("સફળતાપૂર્વક અલગ કર્યું!", 'success');
                
            } else if (mode === 'extract') {
                updateStatus("બધા પેજ અલગ કરી રહ્યા છીએ...", 'processing');
                
                const zipBlob = await splitPdfToZip(currentSplitFile, (current, total) => {
                    updateStatus(`પ્રોસેસિંગ... (${current}/${total} પેજ)`, 'processing');
                });
                
                splitResultUrl = URL.createObjectURL(zipBlob);
                
                dlBtn.innerText = "Download ZIP";
                dlBtn.onclick = () => {
                    const a = document.createElement('a');
                    a.href = splitResultUrl;
                    a.download = currentSplitFile.name.replace('.pdf', '_pages.zip');
                    a.click();
                };
                
                HistoryManager.save({ toolName: 'PDF Split', preset: 'Extract All', size: `${Math.round(zipBlob.size / 1024)} KB` });
                updateStatus("ZIP ફાઇલ તૈયાર છે!", 'success');
            }
            
            dlBtn.classList.remove('hidden');
            
        } catch (e) {
            updateStatus("ભૂલ આવી: " + e.message, 'error');
            console.error(e);
        }
    });

    // --- PDF Rotate Specific Logic ---
    let currentRotateFile = null;
    let currentRotatePageCount = 0;
    let rotateResultUrl = null;
    let selectedRotationAngle = 90; // Default Right (+90)

    const handlePdfRotateFile = async (file) => {
        if (file.type !== 'application/pdf') return alert("માત્ર PDF ફાઇલ માન્ય છે.");
        currentRotateFile = file;
        
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        currentRotatePageCount = pdfDoc.getPageCount();

        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('file-info-section').classList.remove('hidden');
        document.getElementById('rotate-workspace').classList.remove('hidden');
        document.getElementById('rotate-file-name').innerText = file.name;
        document.getElementById('rotate-page-count').innerText = currentRotatePageCount;
        
        // Reset and generate thumbnail
        const thumbContainer = document.getElementById('rotate-file-name').closest('.flex').querySelector('.w-12.h-12');
        if (thumbContainer) {
            thumbContainer.innerHTML = `<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`;
            thumbContainer.classList.add('bg-red-50', 'text-red-500');
            thumbContainer.classList.remove('bg-slate-200', 'overflow-hidden');
        }

        if (rotateResultUrl) {
            URL.revokeObjectURL(rotateResultUrl);
            rotateResultUrl = null;
            document.getElementById('downloadRotateBtn').classList.add('hidden');
        }
        updateStatus("ફાઇલ તૈયાર છે. વિકલ્પો પસંદ કરો.", 'ready');

        try {
            const thumb = await getPdfThumbnail(file);
            if (thumbContainer && thumb) {
                thumbContainer.innerHTML = `<img src="${thumb}" class="w-full h-full object-cover">`;
                thumbContainer.classList.remove('bg-red-50', 'text-red-500');
                thumbContainer.classList.add('bg-slate-200', 'overflow-hidden');
            }
        } catch(e) { console.error('Thumb error', e); }
    };

    document.getElementById('change-rotate-pdf-btn')?.addEventListener('click', () => {
        document.getElementById('rotatePdfInput')?.click();
    });

    document.querySelectorAll('input[name="rotateMode"]')?.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const rangeContainer = document.getElementById('rotate-range-input-container');
            if (e.target.value === 'range') {
                rangeContainer.classList.remove('hidden');
            } else {
                rangeContainer.classList.add('hidden');
            }
        });
    });

    document.querySelectorAll('.rotate-dir-btn')?.forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.rotate-dir-btn').forEach(b => {
                b.classList.remove('btn-primary', 'text-white', 'border-transparent');
                b.classList.add('btn-outline', 'text-slate-600', 'border-slate-200');
            });
            const target = e.currentTarget;
            target.classList.remove('btn-outline', 'text-slate-600', 'border-slate-200');
            target.classList.add('btn-primary', 'text-white', 'border-transparent');
            selectedRotationAngle = parseInt(target.dataset.angle);
        });
    });

    document.getElementById('rotatePdfActionBtn')?.addEventListener('click', async () => {
        if (!currentRotateFile || currentRotatePageCount === 0) return;
        
        const mode = document.querySelector('input[name="rotateMode"]:checked').value;
        const dlBtn = document.getElementById('downloadRotateBtn');
        dlBtn.classList.add('hidden');
        
        try {
            let pageIndices = [];
            if (mode === 'range') {
                const rangeStr = document.getElementById('rotateRangeInput').value;
                pageIndices = parseRangeString(rangeStr, currentRotatePageCount);
                if (!pageIndices || pageIndices.length === 0) {
                    return updateStatus("અમાન્ય પેજ રેન્જ! કૃપા કરીને 1 થી " + currentRotatePageCount + " ની વચ્ચે યોગ્ય રેન્જ દાખલ કરો.", 'error');
                }
            }

            updateStatus("પ્રોસેસિંગ ચાલુ છે...", 'processing');
            const pdfBytes = await rotatePdfPages(currentRotateFile, pageIndices, selectedRotationAngle);
            
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            rotateResultUrl = URL.createObjectURL(blob);
            
            dlBtn.innerText = "Download Rotated PDF";
            dlBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = rotateResultUrl;
                a.download = currentRotateFile.name.replace(/\.pdf$/i, '-rotated.pdf');
                a.click();
                
                setTimeout(() => {
                    URL.revokeObjectURL(rotateResultUrl);
                    rotateResultUrl = null;
                }, 1000);
            };
            
            HistoryManager.save({ toolName: 'PDF Rotate', preset: mode === 'all' ? 'All Pages' : 'Custom Range', size: `${Math.round(blob.size / 1024)} KB` });
            updateStatus("PDF સફળતાપૂર્વક ફેરવવામાં આવી છે!", 'success');
            dlBtn.classList.remove('hidden');
            
        } catch (e) {
            updateStatus("ભૂલ આવી: " + e.message, 'error');
            console.error(e);
        }
    });

    // --- Image Crop Specific Logic ---
    const applyCropBtn = document.getElementById('applyCropBtn');
    if (applyCropBtn) {
        applyCropBtn.onclick = async () => {
            if (!state.cropper || !state.originalImage) return;

            updateStatus("ક્રોપ કરી રહ્યા છીએ...", 'processing');

            const isPng = state.mimeType === 'image/png';
            const format = isPng ? 'image/png' : 'image/jpeg';
            const ext = isPng ? 'png' : 'jpg';

            const canvas = state.cropper.getCroppedCanvas({
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            canvas.toBlob((blob) => {
                if (!blob) {
                    updateStatus("ભૂલ આવી: ઇમેજ ક્રોપ કરવામાં નિષ્ફળ", 'error');
                    return;
                }
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `cropped_image.${ext}`;
                link.click();

                HistoryManager.save({
                    toolName: 'Image Crop',
                    preset: 'Custom Crop',
                    size: `${Math.round(blob.size / 1024)} KB`
                });

                updateStatus(`સફળતાપૂર્વક ક્રોપ થયું! સાઈઝ: ${Math.round(blob.size / 1024)} KB`, 'success');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, format, 1);
        };
    }

    // Aspect Ratio Buttons
    document.querySelectorAll('.aspect-btn').forEach(btn => {
        btn.onclick = () => {
            if (!state.cropper) return;
            const ratio = parseFloat(btn.getAttribute('data-ratio'));
            state.cropper.setAspectRatio(isNaN(ratio) ? NaN : ratio);
            
            document.querySelectorAll('.aspect-btn').forEach(b => {
                b.classList.remove('btn-primary', 'text-white', 'border-transparent');
                b.classList.add('btn-outline', 'text-slate-600', 'border-slate-200');
            });
            
            btn.classList.remove('btn-outline', 'text-slate-600', 'border-slate-200');
            btn.classList.add('btn-primary', 'text-white', 'border-transparent');
        };
    });

    // Rotation Buttons
    document.getElementById('rotateLeftBtn')?.addEventListener('click', () => {
        if (state.cropper) state.cropper.rotate(-90);
    });
    document.getElementById('rotateRightBtn')?.addEventListener('click', () => {
        if (state.cropper) state.cropper.rotate(90);
    });
    document.getElementById('resetCropBtn')?.addEventListener('click', () => {
        if (state.cropper) state.cropper.reset();
    });

    // --- Hook One-Click Buttons ---
    document.querySelectorAll('.quick-process-btn').forEach(btn => {
        btn.onclick = () => {
            const presetKey = btn.getAttribute('data-preset');
            const type = presetSelect?.getAttribute('data-tool-type') || 'photo';
            runQuickProcess(presetKey, type);
        };
    });

    // Handle Change Photo Button across all tool pages
    document.addEventListener('click', (e) => {
        if (e.target.id === 'change-photo-btn' || e.target.closest('#change-photo-btn')) {
            document.getElementById('imageInput')?.click();
        }
    });
});