import { GOVT_PRESETS } from './govt_presets.js';
import { mergePDFs, convertImagesToPdf } from './pdf-logic.js';
import * as Engine from './image-engine.js';
import { ImageUploader } from './image-uploader.js';
import { ImagePreviewer } from './image-previewer.js';
import { HistoryManager } from './history-manager.js';

const state = {
    originalImage: null,
    cropper: null,
    bgColor: 'original',
    isTransparent: false,
    isBlackAndWhite: false
};

const updateStatus = (msg) => {
    const statusMsg = document.getElementById('statusMsg');
    if (statusMsg) statusMsg.innerText = msg;
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
    updateStatus(`${preset.label} મોડ: પ્રોસેસિંગ ચાલુ છે...`);

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

        updateStatus(`${preset.label} ફાઇલ તૈયાર છે!`);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    reader.readAsDataURL(blob);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize Common Preview Component ---
    ImagePreviewer.render('image-preview-container');

    // --- Initialize Common Upload Component ---
    const presetSelect = document.getElementById('presetSelect');
    const statusMsg = document.getElementById('statusMsg');
    const previewArea = document.getElementById('previewArea');
    const brightnessInput = document.getElementById('brightnessInput');
    const contrastInput = document.getElementById('contrastInput');
    const manualWidth = document.getElementById('manualWidth');
    const manualHeight = document.getElementById('manualHeight');

    // Populate Preset Select dynamically from centralized engine
    if (presetSelect) {
        Object.entries(GOVT_PRESETS).forEach(([key, preset]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = preset.label;
            presetSelect.appendChild(option);
        });

        // Determine context (Signature vs Photo)
        const isSignaturePage = !!document.getElementById('downloadSign');
        const toolType = isSignaturePage ? 'signature' : 'photo';
        presetSelect.setAttribute('data-tool-type', toolType);
    }

    ImageUploader.render('image-upload-container', (imageSrc) => {
        if (state.cropper) state.cropper.destroy();
        
        const img = new Image();
        img.onload = () => {
            state.originalImage = img;
            
            // Show the workspace
            if (previewArea) previewArea.classList.remove('hidden');
            
            // Set natural dimensions as defaults for manual inputs if empty (useful for compression tool)
            if (manualWidth && !manualWidth.value) manualWidth.value = img.naturalWidth;
            if (manualHeight && !manualHeight.value) manualHeight.value = img.naturalHeight;

            // Update Metadata Labels
            const sizeInKb = Math.round((imageSrc.length * 0.75) / 1024);
            const mimeType = imageSrc.substring(imageSrc.indexOf(':') + 1, imageSrc.indexOf(';'));
            const format = mimeType.split('/')[1].toUpperCase();

            ImagePreviewer.updateMetadata({
                width: img.naturalWidth,
                height: img.naturalHeight,
                size: sizeInKb,
                format: format
            });

            renderPreview(img);
            updateStatus("ફાઇલ અપલોડ થઈ ગઈ છે. હવે ડાઉનલોડ બટન પર ક્લિક કરો.");
        };
        img.src = imageSrc;
    });

    // --- Photo Resize Tool: Apply Resize Logic ---
    const applyResizeBtn = document.getElementById('applyResize');
    if (applyResizeBtn) {
        applyResizeBtn.onclick = () => {
            if (!state.cropper || !state.originalImage) return;

            const width = parseInt(manualWidth?.value);
            const height = parseInt(manualHeight?.value);

            if (!width || !height || width <= 0 || height <= 0) {
                updateStatus("કૃપા કરીને સાચું માપ (પહોળાઈ અને ઊંચાઈ) દાખલ કરો.");
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
            
            updateStatus(`ઇમેજ સફળતાપૂર્વક ${width}x${height} માં રીસાઇઝ થઈ ગઈ છે.`);
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

            updateStatus(`ઇમેજને ${targetKb} KB માં કમ્પ્રેસ કરી રહ્યા છીએ...`);

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

    let targetWidth, targetHeight, minKb, maxKb;

    if (presetSelect.value === 'custom') {
        targetWidth = parseInt(manualWidth?.value) || state.originalImage.naturalWidth;
        targetHeight = parseInt(manualHeight?.value) || state.originalImage.naturalHeight;
        
        // Handle compression target size for custom settings if the input exists
        const targetKbInput = document.getElementById('targetSize');
        maxKb = targetKbInput ? parseInt(targetKbInput.value) : 100;
        minKb = Math.max(5, maxKb - 20); // Basic range buffer for the engine
    } else {
        const preset = GOVT_PRESETS[presetSelect.value];
        const config = type === 'photo' ? preset.photo : preset.signature;
        targetWidth = config.width;
        targetHeight = config.height;
        minKb = config.minKb;
        maxKb = config.maxKb;
    }

    // Get cropped canvas from cropper with exact dimensions
    const croppedCanvas = state.cropper.getCroppedCanvas({ width: targetWidth, height: targetHeight });
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    const fCtx = finalCanvas.getContext('2d');

    if (state.bgColor !== 'original') {
        fCtx.fillStyle = state.bgColor;
        fCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    }

    Engine.applyFilters(fCtx, {
        brightness: brightnessInput?.value || 100,
        contrast: contrastInput?.value || 100,
        isBlackAndWhite: type === 'sign' && state.isBlackAndWhite
    });
    
    fCtx.drawImage(croppedCanvas, 0, 0);

    updateStatus("પ્રોસેસિંગ ચાલુ છે...");
    const format = (type === 'sign' && state.isTransparent) ? 'image/png' : 'image/jpeg';
    const blob = await Engine.compressToTargetKB(finalCanvas, minKb, maxKb, format);
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const extension = format === 'image/png' ? 'png' : 'jpg';
    link.download = `${presetSelect.value}_${type}_${Math.round(blob.size/1024)}kb.${extension}`;
    link.click();

    HistoryManager.save({
        toolName: type === 'sign' ? 'Signature Resize' : 'Photo Resize',
        preset: presetSelect.value === 'custom' ? 'Custom' : GOVT_PRESETS[presetSelect.value]?.label,
        size: `${Math.round(blob.size/1024)} KB`
    });

    updateStatus(`સફળતાપૂર્વક ડાઉનલોડ થયું! સાઈઝ: ${Math.round(blob.size/1024)} KB`);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    return finalCanvas;
}

async function generatePrintSheet() {
    const photoCanvas = await downloadAdjusted('photo');
    if (!photoCanvas) return;
    updateStatus("પ્રિન્ટ શીટ બનાવી રહ્યા છીએ...");
    await Engine.createPrintSheet(photoCanvas);
    updateStatus("પ્રિન્ટ શીટ તૈયાર છે!");
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
    const files = document.getElementById('jpgToPdfInput').files;
    if (files.length === 0) return alert("કૃપા કરીને ઈમેજીસ પસંદ કરો");
    
    if (pdfStatus) pdfStatus.innerText = "PDF બનાવી રહ્યા છીએ...";
    try {
        const pdfBytes = await convertImagesToPdf(Array.from(files));
        downloadFile(pdfBytes, 'images_converted.pdf', 'application/pdf');
        
        HistoryManager.save({
            toolName: 'JPG to PDF',
            preset: 'N/A',
            size: `${Math.round(pdfBytes.length / 1024)} KB`
        });

        if (pdfStatus) pdfStatus.innerText = "PDF સફળતાપૂર્વક ડાઉનલોડ થઈ ગઈ!";
    } catch (e) { if (pdfStatus) pdfStatus.innerText = "ભૂલ આવી: " + e.message; }
});

document.getElementById('mergePdfBtn')?.addEventListener('click', async () => {
    const files = document.getElementById('mergePdfInput').files;
    if (files.length < 2) return alert("મર્જ કરવા માટે ઓછામાં ઓછી 2 PDF પસંદ કરો");
    
    if (pdfStatus) pdfStatus.innerText = "PDF મર્જ કરી રહ્યા છીએ...";
    try {
        const pdfBytes = await mergePDFs(Array.from(files));
        downloadFile(pdfBytes, 'merged_document.pdf', 'application/pdf');

        HistoryManager.save({
            toolName: 'PDF Merge',
            preset: 'N/A',
            size: `${Math.round(pdfBytes.length / 1024)} KB`
        });

        if (pdfStatus) pdfStatus.innerText = "PDF સફળતાપૂર્વક મર્જ થઈ ગઈ!";
    } catch (e) { if (pdfStatus) pdfStatus.innerText = "ભૂલ આવી: " + e.message; }
});

    // --- Hook One-Click Buttons ---
    document.querySelectorAll('.quick-process-btn').forEach(btn => {
        btn.onclick = () => {
            const presetKey = btn.getAttribute('data-preset');
            const type = presetSelect?.getAttribute('data-tool-type') || 'photo';
            runQuickProcess(presetKey, type);
        };
    });
});