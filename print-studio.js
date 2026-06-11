import * as Engine from './image-engine.js';
import { HistoryManager } from './history-manager.js';

const MM_TO_PX = 3.77952;

const TEMPLATES = {
    'aadhaar': {
        name: 'Aadhaar Card (Front + Back)',
        slots: [
            { id: 'front', label: 'Front Side', width: 85.6, height: 54, left: 62.2, top: 30 },
            { id: 'back', label: 'Back Side', width: 85.6, height: 54, left: 62.2, top: 90 }
        ]
    },
    'pan': {
        name: 'PAN Card',
        slots: [
            { id: 'front', label: 'PAN Front', width: 85.6, height: 54, left: 62.2, top: 40 }
        ]
    },
    'election': {
        name: 'Voter ID / Election Card',
        slots: [
            { id: 'front', label: 'Front Side', width: 85.6, height: 54, left: 62.2, top: 30 },
            { id: 'back', label: 'Back Side', width: 85.6, height: 54, left: 62.2, top: 90 }
        ]
    },
    'driving-licence': {
        name: 'Driving Licence (Front + Back)',
        slots: [
            { id: 'front', label: 'Front Side', width: 85.6, height: 54, left: 62.2, top: 30 },
            { id: 'back', label: 'Back Side', width: 85.6, height: 54, left: 62.2, top: 90 }
        ]
    },
    'ration': {
        name: 'Ration Card',
        slots: [
            { id: 'front', label: 'Front Page', width: 100, height: 150, left: 55, top: 15 },
            { id: 'back', label: 'Back Page', width: 100, height: 150, left: 55, top: 170 }
        ]
    },
    'passport-4': {
        name: 'Passport Photos (4 Copies)',
        slots: Array.from({length: 4}).map((_, i) => ({
            id: `pass-${i}`, label: 'Photo', width: 35, height: 45,
            left: 67.5 + (i % 2) * 40, top: 101 + Math.floor(i/2) * 50
        }))
    },
    'passport-6': {
        name: 'Passport Photos (6 Copies)',
        slots: Array.from({length: 6}).map((_, i) => ({
            id: `pass-${i}`, label: 'Photo', width: 35, height: 45,
            left: 47.5 + (i % 3) * 40, top: 101 + Math.floor(i/3) * 50
        }))
    },
    'passport-8': {
        name: 'Passport Photos (8 Copies)',
        slots: Array.from({length: 8}).map((_, i) => ({
            id: `pass-${i}`, label: 'Photo', width: 35, height: 45,
            left: 27.5 + (i % 4) * 40, top: 101 + Math.floor(i/4) * 50
        }))
    },
    'passport-12': {
        name: 'Passport Photos (12 Copies)',
        slots: Array.from({length: 12}).map((_, i) => ({
            id: `pass-${i}`, label: 'Photo', width: 35, height: 45,
            left: 27.5 + (i % 4) * 40, top: 76 + Math.floor(i/4) * 50
        }))
    },
    'passport-30': {
        name: 'Passport Photos (A4 Sheet)',
        slots: Array.from({length: 30}).map((_, i) => ({
            id: `pass-${i}`,
            label: 'Photo',
            width: 35,
            height: 45,
            left: 10 + (i % 5) * 38,
            top: 10 + Math.floor(i / 5) * 48
        }))
    },
    'doc-scan': {
        name: 'Full Document Scan (A4)',
        slots: [
            { id: 'doc', label: 'Full Page Scan', width: 190, height: 277, left: 10, top: 10 }
        ]
    },
    'custom': {
        name: 'Custom Layout',
        slots: []
    }
};

const state = {
    template: 'aadhaar',
    slots: [],
    uploadedImages: [],
    uploadedFileNames: [],
    customMode: false,
    editingSlotIndex: -1,
    cropper: null,
    targetSlotForGallery: -1,
    editingBw: false
};

const updateStatus = (msg, type = 'ready') => {
    const container = document.getElementById('statusContainer');
    const msgEl = document.getElementById('statusMsg');
    if (msgEl) msgEl.innerText = msg;
    if (container) {
        container.className = `mb-6 px-4 py-3 rounded-xl border ${
            type === 'processing' ? 'bg-blue-50 border-blue-200 text-blue-700' :
            type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
            type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-slate-100 border-slate-200 text-slate-700'
        }`;
    }
};

function resizeWorkspace() {
    const container = document.getElementById('workspace-container');
    const parent = document.getElementById('workspace-wrapper');
    if (!container || !parent) return;
    const a4WidthPx = 794; 
    const availableWidth = parent.clientWidth - 32;
    
    if (availableWidth < a4WidthPx) {
        const scale = availableWidth / a4WidthPx;
        container.style.transform = `scale(${scale})`;
        parent.style.height = `${(1123 * scale) + 32}px`;
    } else {
        container.style.transform = 'none';
        parent.style.height = 'auto';
    }
}

function renderSlots() {
    const layer = document.getElementById('slots-layer');
    if (!layer) return;
    layer.innerHTML = '';
    
    state.slots.forEach((slot, index) => {
        const div = document.createElement('div');
        div.className = 'slot-wrapper group';
        div.style.width = `${slot.width * MM_TO_PX}px`;
        div.style.height = `${slot.height * MM_TO_PX}px`;
        div.style.left = `${slot.left * MM_TO_PX}px`;
        div.style.top = `${slot.top * MM_TO_PX}px`;
        div.dataset.index = index;

        if (slot.image) {
            const img = document.createElement('img');
            img.src = slot.image;
            img.alt = slot.fileName || slot.label || 'Uploaded document';
            div.appendChild(img);
            
            if (slot.label) {
                const labelBadge = document.createElement('div');
                labelBadge.className = 'slot-badge absolute top-3 left-3 bg-slate-900/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md pointer-events-none z-10 shadow-sm truncate max-w-[85%]';
                labelBadge.innerText = slot.fileName ? `${slot.label} - ${slot.fileName}` : slot.label;
                div.appendChild(labelBadge);
            }
            
            const actions = document.createElement('div');
            actions.className = 'slot-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'p-1.5 bg-white text-blue-600 rounded-md shadow-md hover:bg-blue-50';
            editBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
            editBtn.onclick = (e) => { e.stopPropagation(); openEditor(index); };
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'p-1.5 bg-white text-red-600 rounded-md shadow-md hover:bg-red-50';
            clearBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
            clearBtn.onclick = (e) => { e.stopPropagation(); clearSlot(index); };

            const smartActions = document.createElement('div');
            smartActions.className = 'absolute bottom-1 left-1 flex gap-1';
            smartActions.innerHTML = `
                <button title="Auto Fit in Editor" class="smart-action-btn text-slate-700 rounded-md shadow-md hover:bg-blue-50 text-xs" data-action="fit">Fit</button>
                <button title="Center on Page" class="smart-action-btn text-slate-700 rounded-md shadow-md hover:bg-blue-50 text-xs ${state.customMode ? '' : 'hidden'}" data-action="center">Center</button>
                <button title="Rotate Slot" class="smart-action-btn text-slate-700 rounded-md shadow-md hover:bg-blue-50 text-xs" data-action="rotate">Rotate</button>
            `;
            smartActions.querySelectorAll('.smart-action-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    handleSmartAction(index, e.currentTarget.dataset.action);
                };
            });
            
            actions.appendChild(editBtn);
            actions.appendChild(clearBtn);
            div.appendChild(actions);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'text-center p-2 cursor-pointer w-full h-full flex flex-col items-center justify-center';
            placeholder.innerHTML = `
                <svg class="w-6 h-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                <span class="text-[10px] font-bold text-slate-500">${slot.label || 'Select Image'}</span>
            `;
            placeholder.onclick = () => openGallerySelector(index);
            div.appendChild(placeholder);
        }
        
        const resizer = document.createElement('div');
        resizer.className = 'slot-resize-handle';
        div.appendChild(resizer);
        // The smartActions div is already appended within the if (slot.image) block.
        
        attachDragEvents(div, slot, index, resizer);
        layer.appendChild(div);
    });

    // Toggle Swap Button Visibility
    const swapBtn = document.getElementById('swapImagesBtn');
    if (swapBtn) {
        if (state.slots.length === 2 && state.slots[0].image && state.slots[1].image) {
            swapBtn.classList.remove('hidden');
        } else {
            swapBtn.classList.add('hidden');
        }
    }
}

function attachDragEvents(el, slot, index, resizer) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;
    
    const getScale = () => {
        const container = document.getElementById('workspace-container');
        const transform = container.style.transform;
        if (transform && transform.includes('scale')) {
            const match = transform.match(/scale\(([^)]+)\)/);
            if (match) return parseFloat(match[1]);
        }
        return 1;
    };

    const handleDown = (e) => {
        if (!state.customMode) return;
        if (e.target === resizer) {
            isResizing = true;
        } else {
            if (e.target.closest('button')) return;
            isDragging = true;
        }
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        startX = clientX;
        startY = clientY;
        startLeft = slot.left;
        startTop = slot.top;
        startWidth = slot.width;
        startHeight = slot.height;
        
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchmove', handleMove, {passive: false});
        document.addEventListener('mouseup', handleUp);
        document.addEventListener('touchend', handleUp);
    };

    const handleMove = (e) => {
        if (!isDragging && !isResizing) return;
        e.preventDefault();
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const scale = getScale();
        const dx = (clientX - startX) / scale / MM_TO_PX;
        const dy = (clientY - startY) / scale / MM_TO_PX;
        
        if (isDragging) {
            slot.left = startLeft + dx;
            slot.top = startTop + dy;
            el.style.left = `${slot.left * MM_TO_PX}px`;
            el.style.top = `${slot.top * MM_TO_PX}px`;
        } else if (isResizing) {
            slot.width = Math.max(10, startWidth + dx);
            slot.height = Math.max(10, startHeight + dy);
            el.style.width = `${slot.width * MM_TO_PX}px`;
            el.style.height = `${slot.height * MM_TO_PX}px`;
        }
    };

    const handleUp = () => {
        isDragging = false;
        isResizing = false;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.removeEventListener('touchend', handleUp);
    };

    el.addEventListener('mousedown', handleDown);
    el.addEventListener('touchstart', handleDown, {passive: false});
}

async function autoFillSlots() {
    if (state.uploadedImages.length === 0) return;
    let imgIdx = 0;
    
    updateStatus("સ્માર્ટ ઓટો-ફિટ પ્રક્રિયા ચાલુ છે...", "processing");

    for (let i = 0; i < state.slots.length; i++) {
        if (!state.slots[i].image && imgIdx < state.uploadedImages.length) {
            const imgSrc = state.uploadedImages[imgIdx];
            const slot = state.slots[i];
            
            // Smart Aspect-Ratio Rotation (Fixes WhatsApp portrait photos for landscape ID cards)
            const orientedSrc = await applySmartRotation(imgSrc, slot.width, slot.height);
            
            slot.image = orientedSrc;
            slot.originalImage = (' ' + orientedSrc).slice(1);
            slot.fileName = state.uploadedFileNames ? state.uploadedFileNames[imgIdx] : 'Image';
            
            if (!state.template.startsWith('passport')) imgIdx++; 
        }
    }
    renderSlots();
    updateStatus("ઓટોમેટિક લેઆઉટ તૈયાર છે. પ્રિન્ટ કરી શકો છો.", "success");
}

function applySmartRotation(imgSrc, slotWidth, slotHeight) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const isImgLandscape = img.width > img.height;
            const isSlotLandscape = slotWidth > slotHeight;
            
            // If orientations mismatch heavily, auto-rotate 90 degrees
            if (isImgLandscape !== isSlotLandscape && Math.abs(img.width - img.height) > 20) {
                const canvas = document.createElement('canvas');
                canvas.width = img.height;
                canvas.height = img.width;
                const ctx = canvas.getContext('2d');
                ctx.translate(canvas.width/2, canvas.height/2);
                ctx.rotate(90 * Math.PI / 180);
                ctx.drawImage(img, -img.width/2, -img.height/2);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            } else {
                resolve(imgSrc);
            }
        };
        img.src = imgSrc;
    });
}

function handleSmartAction(index, action) {
    const slot = state.slots[index];
    if (!slot || !slot.image) return;
    if (action === 'fit') openEditor(index);
    else if (action === 'center') { slot.left = (210 - slot.width) / 2; slot.top = (297 - slot.height) / 2; } 
    else if (action === 'rotate') {
        // Rotate the actual image 90 degrees, keeping slot size intact
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.height;
            canvas.height = img.width;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width/2, canvas.height/2);
            ctx.rotate(90 * Math.PI / 180);
            ctx.drawImage(img, -img.width/2, -img.height/2);
            slot.image = canvas.toDataURL('image/jpeg', 0.95);
            slot.originalImage = (' ' + slot.image).slice(1);
            renderSlots();
        };
        img.src = slot.image;
    }
}

function processFiles(files) {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;
    
    updateStatus("ફોટા લોડ કરી રહ્યા છીએ...", "processing");
    
    let loaded = 0;
    validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.uploadedImages.push(e.target.result);
            if (!state.uploadedFileNames) state.uploadedFileNames = [];
            state.uploadedFileNames.push(file.name);
            loaded++;
            
            if (loaded === validFiles.length) {
                renderGallery();
                autoFillSlots();
                if (validFiles.length === 2 && ['aadhaar', 'election', 'driving-licence'].includes(state.template)) {
                    updateStatus("2 images uploaded and auto-placed for front and back.", "success");
                } else {
                    updateStatus("ફોટા સફળતાપૂર્વક અપલોડ થઈ ગયા છે.", "success");
                }
            }
        };
        reader.onerror = () => {
            loaded++;
            updateStatus(`Error reading file ${file.name}. It may be corrupted.`, 'error');
            if (loaded === validFiles.length) renderGallery();
        };
        reader.readAsDataURL(file);
    });
}

function renderGallery() {
    const container = document.getElementById('galleryContainer');
    const list = document.getElementById('galleryList');
    const title = document.getElementById('galleryTitle');
    if (!container || !list) return;
    
    if (state.uploadedImages.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    if (title) {
        title.innerText = `${state.uploadedImages.length} Image${state.uploadedImages.length !== 1 ? 's' : ''} Uploaded`;
    }

    container.classList.remove('hidden');
    list.innerHTML = state.uploadedImages.map((src, idx) => `
        <div class="flex flex-col gap-1">
            <div class="relative group cursor-pointer aspect-square rounded-xl overflow-hidden border border-slate-200" onclick="window.useImageFromGallery(${idx})">
                <img src="${src}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                    <span class="opacity-0 group-hover:opacity-100 bg-white text-blue-600 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">Use</span>
                </div>
            </div>
            <div class="text-[9px] text-slate-500 truncate text-center px-1" title="${state.uploadedFileNames?.[idx] || 'Image'}">${state.uploadedFileNames?.[idx] || 'Image'}</div>
        </div>
    `).join('');
}

window.useImageFromGallery = (imgIdx) => {
    if (state.targetSlotForGallery !== -1) {
        state.slots[state.targetSlotForGallery].image = state.uploadedImages[imgIdx];
        state.slots[state.targetSlotForGallery].originalImage = state.uploadedImages[imgIdx];
        state.slots[state.targetSlotForGallery].fileName = state.uploadedFileNames ? state.uploadedFileNames[imgIdx] : '';
        renderSlots();
        document.getElementById('galleryModal')?.classList.add('hidden');
        state.targetSlotForGallery = -1;
    } else {
        const emptySlotIdx = state.slots.findIndex(s => !s.image);
        if (emptySlotIdx !== -1) {
            state.slots[emptySlotIdx].image = state.uploadedImages[imgIdx];
            state.slots[emptySlotIdx].originalImage = state.uploadedImages[imgIdx];
            state.slots[emptySlotIdx].fileName = state.uploadedFileNames ? state.uploadedFileNames[imgIdx] : '';
            renderSlots();
        }
    }
};

function openGallerySelector(slotIndex) {
    state.targetSlotForGallery = slotIndex;
    const list = document.getElementById('galleryModalList');
    const emptyState = document.getElementById('galleryModalEmpty');
    
    if (!list || !emptyState) return;

    if (state.uploadedImages.length === 0) {
        list.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        list.classList.remove('hidden');
        list.innerHTML = state.uploadedImages.map((src, idx) => `
            <div class="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 h-32" onclick="window.useImageFromGallery(${idx})">
                <img src="${src}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                    <span class="opacity-0 group-hover:opacity-100 bg-white text-blue-600 text-xs font-bold px-3 py-1.5 rounded-md shadow-sm">Select</span>
                </div>
            </div>
        `).join('');
    }
    document.getElementById('galleryModal')?.classList.remove('hidden');
}

function clearSlot(index) {
    state.slots[index].image = null;
    state.slots[index].originalImage = null;
    state.slots[index].fileName = null;
    renderSlots();
}

function loadTemplate(key) {
    state.template = key;
    state.slots = JSON.parse(JSON.stringify(TEMPLATES[key].slots));
    
    if (key === 'custom' || state.customMode) {
        const toggle = document.getElementById('customModeToggle');
        if (toggle) toggle.checked = true;
        state.customMode = true;
        document.getElementById('addSlotBtn')?.classList.remove('hidden');
    } else {
        const toggle = document.getElementById('customModeToggle');
        if (toggle) toggle.checked = false;
        state.customMode = false;
        document.getElementById('addSlotBtn')?.classList.add('hidden');
    }
    
    autoFillSlots();
    document.getElementById('workspace-container')?.classList.toggle('custom-mode-active', state.customMode);
}

function closeEditor() {
    if (state.cropper) {
        state.cropper.destroy();
        state.cropper = null;
    }
    document.getElementById('editorModal')?.classList.add('hidden');
    state.editingSlotIndex = -1;
}

function openEditor(slotIndex) {
    state.editingSlotIndex = slotIndex;
    const slot = state.slots[slotIndex];
    
    document.getElementById('editorModal')?.classList.remove('hidden');
    const imageEl = document.getElementById('cropperImage');
    if (imageEl) imageEl.src = slot.originalImage || slot.image;
    
    const b = document.getElementById('brightnessInput');
    const c = document.getElementById('contrastInput');
    const bw = document.getElementById('bwCheckbox');
    if (b) b.value = 100;
    if (c) c.value = 100;
    if (bw) bw.checked = false;
    updateCropperFilter();
    
    if (state.cropper) state.cropper.destroy();
    
    if (imageEl) {
        const ratio = slot.width / slot.height;
        state.cropper = new window.Cropper(imageEl, {
            aspectRatio: ratio,
            viewMode: 1,
            autoCropArea: 1,
        });
    }
}

function autoCropDocument(imageElement, cropper) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = imageElement.naturalWidth;
    const h = imageElement.naturalHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(imageElement, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const getPixel = (x, y) => {
        const i = (y * w + x) * 4;
        return [data[i], data[i+1], data[i+2]];
    };

    const corners = [
        getPixel(0, 0), getPixel(w-1, 0),
        getPixel(0, h-1), getPixel(w-1, h-1)
    ];
    
    let r=0, g=0, b=0;
    corners.forEach(c => { r+=c[0]; g+=c[1]; b+=c[2]; });
    r/=4; g/=4; b/=4;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    const threshold = 40; 
    const step = 4;

    for (let y = 0; y < h; y+=step) {
        for (let x = 0; x < w; x+=step) {
            const idx = (y * w + x) * 4;
            if (Math.abs(data[idx] - r) > threshold || Math.abs(data[idx+1] - g) > threshold || Math.abs(data[idx+2] - b) > threshold) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (minX < maxX && minY < maxY && (maxX - minX) > w * 0.1 && (maxY - minY) > h * 0.1) {
        const padding = Math.min(w, h) * 0.02;
        cropper.setData({
            x: Math.max(0, minX - padding), y: Math.max(0, minY - padding),
            width: Math.min(w, maxX + padding) - Math.max(0, minX - padding),
            height: Math.min(h, maxY + padding) - Math.max(0, minY - padding)
        });
        return true;
    }
    return false;
}

const updateCropperFilter = () => {
    if (!state.cropper) return;
    const b = document.getElementById('brightnessInput')?.value || 100;
    const c = document.getElementById('contrastInput')?.value || 100;
    const bw = document.getElementById('bwCheckbox')?.checked || false;
    const imgElement = document.querySelector('#editorModal .cropper-view-box img');
    if (imgElement) {
        let filterString = `brightness(${b}%) contrast(${c}%)`;
        if (bw) {
            filterString += ` grayscale(100%)`;
        }
        imgElement.style.filter = filterString;
    }
};

async function exportToPdf() {
    updateStatus("PDF બનાવી રહ્યા છીએ...", "processing");
    try {
        const { PDFDocument } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]);
        const MM_TO_PT = 2.83465;

        for (const slot of state.slots) {
            if (!slot.image) continue;
            const res = await fetch(slot.image);
            const arrayBuffer = await res.arrayBuffer();
            
            const pdfImage = slot.image.startsWith('data:image/png')
                ? await pdfDoc.embedPng(arrayBuffer)
                : await pdfDoc.embedJpg(arrayBuffer);

            const x = slot.left * MM_TO_PT;
            const width = slot.width * MM_TO_PT;
            const height = slot.height * MM_TO_PT;
            const y = 841.89 - (slot.top * MM_TO_PT) - height;

            page.drawImage(pdfImage, { x, y, width, height });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `Print_Studio_${Date.now()}.pdf`;
        a.click();
        
        HistoryManager.save({ toolName: 'Print Studio', preset: state.template, size: `${Math.round(blob.size/1024)} KB` });
        updateStatus("PDF સફળતાપૂર્વક ડાઉનલોડ થઈ!", "success");
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
        updateStatus("ભૂલ આવી: " + e.message, "error");
    }
}

async function exportToJpg() {
    updateStatus("JPG બનાવી રહ્યા છીએ...", "processing");
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 2480;
        canvas.height = 3508;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const MM_TO_300DPI = 11.811;
        
        for (const slot of state.slots) {
            if (!slot.image) continue;
            const img = new Image();
            await new Promise(resolve => {
                img.onload = resolve;
                img.src = slot.image;
            });
            ctx.drawImage(img, slot.left * MM_TO_300DPI, slot.top * MM_TO_300DPI, slot.width * MM_TO_300DPI, slot.height * MM_TO_300DPI);
        }
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Print_Studio_${Date.now()}.jpg`;
            a.click();
            
            HistoryManager.save({ toolName: 'Print Studio', preset: state.template, size: `${Math.round(blob.size/1024)} KB` });
            updateStatus("JPG સફળતાપૂર્વક ડાઉનલોડ થઈ!", "success");
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }, 'image/jpeg', 0.95);
    } catch (e) {
        updateStatus("ભૂલ આવી: " + e.message, "error");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    resizeWorkspace();
    window.addEventListener('resize', resizeWorkspace);
    loadTemplate('aadhaar');

    const templateSelect = document.getElementById('templateSelect');
    const passportOptions = document.getElementById('passport-options');

    document.getElementById('quick-aadhaar')?.addEventListener('click', () => loadTemplate('aadhaar'));
    document.getElementById('quick-voter')?.addEventListener('click', () => loadTemplate('election'));
    document.getElementById('quick-dl')?.addEventListener('click', () => loadTemplate('driving-licence'));
    document.getElementById('quick-pan')?.addEventListener('click', () => loadTemplate('pan'));
    document.getElementById('quick-doc')?.addEventListener('click', () => loadTemplate('doc-scan'));
    document.getElementById('quick-passport')?.addEventListener('click', () => {
        if (templateSelect) {
            templateSelect.value = 'passport';
            templateSelect.dispatchEvent(new Event('change'));
        }
    });

    templateSelect?.addEventListener('change', (e) => {
        const key = e.target.value;
        if (key === 'passport') {
            passportOptions?.classList.remove('hidden');
            const checkedPassportRadio = document.querySelector('input[name="passport_copies"]:checked');
            if (checkedPassportRadio) {
                loadTemplate(checkedPassportRadio.value);
            }
        } else {
            passportOptions?.classList.add('hidden');
            loadTemplate(key);
        }
    });

    document.querySelectorAll('input[name="passport_copies"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) loadTemplate(e.target.value);
        });
    });
    
    document.getElementById('customModeToggle')?.addEventListener('change', (e) => {
        state.customMode = e.target.checked;
        document.getElementById('workspace-container')?.classList.toggle('custom-mode-active', state.customMode);
        document.getElementById('addSlotBtn')?.classList.toggle('hidden', !state.customMode);
    });
    
    document.getElementById('addSlotBtn')?.addEventListener('click', () => {
        state.slots.push({
            id: `custom-${Date.now()}`,
            label: 'New Slot',
            width: 85.6,
            height: 54,
            left: 20,
            top: 20
        });
        renderSlots();
    });
    
    document.getElementById('swapImagesBtn')?.addEventListener('click', () => {
        if (state.slots.length >= 2) {
            const tempImg = state.slots[0].image;
            const tempOrig = state.slots[0].originalImage;
            const tempFileName = state.slots[0].fileName;
            state.slots[0].image = state.slots[1].image;
            state.slots[0].originalImage = state.slots[1].originalImage;
            state.slots[0].fileName = state.slots[1].fileName;
            state.slots[1].image = tempImg;
            state.slots[1].originalImage = tempOrig;
            state.slots[1].fileName = tempFileName;
            renderSlots();
            updateStatus("આગળ અને પાછળનો ભાગ બદલાઈ ગયો છે.", "success");
        }
    });
    
    const dropZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('fileInput');
    if (dropZone && fileInput) {
        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => { processFiles(e.target.files); e.target.value = ''; };
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('bg-blue-50', 'border-blue-500'); };
        dropZone.ondragleave = () => dropZone.classList.remove('bg-blue-50', 'border-blue-500');
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('bg-blue-50', 'border-blue-500');
            processFiles(e.dataTransfer.files);
        };
    }
    
    document.getElementById('galleryModalUploadBtn')?.addEventListener('click', () => {
        document.getElementById('galleryModal')?.classList.add('hidden');
        document.getElementById('fileInput')?.click();
    });

    document.getElementById('clearGalleryBtn')?.addEventListener('click', () => {
        state.uploadedImages = [];
        state.uploadedFileNames = [];
        renderGallery();
        updateStatus("All uploaded images have been cleared.", "ready");
    });
    
    document.getElementById('brightnessInput')?.addEventListener('input', updateCropperFilter);
    document.getElementById('contrastInput')?.addEventListener('input', updateCropperFilter);
    document.getElementById('bwCheckbox')?.addEventListener('change', updateCropperFilter);

    document.getElementById('autoEnhanceBtn')?.addEventListener('click', () => {
        const b = document.getElementById('brightnessInput');
        const c = document.getElementById('contrastInput');
        const bw = document.getElementById('bwCheckbox');
        if (b) b.value = 110;
        if (c) c.value = 125;
        if (bw) bw.checked = false;
        updateCropperFilter();
    });

    document.getElementById('highContrastBtn')?.addEventListener('click', () => {
        const b = document.getElementById('brightnessInput');
        const c = document.getElementById('contrastInput');
        if (b) b.value = 110;
        if (c) c.value = 150;
        updateCropperFilter();
    });

    document.getElementById('removeShadowsBtn')?.addEventListener('click', () => {
        const b = document.getElementById('brightnessInput');
        const c = document.getElementById('contrastInput');
        if (b) b.value = 130;
        if (c) c.value = 120;
        updateCropperFilter();
    });

    document.getElementById('whiteBgBtn')?.addEventListener('click', () => {
        const b = document.getElementById('brightnessInput');
        const c = document.getElementById('contrastInput');
        const bw = document.getElementById('bwCheckbox');
        if (b) b.value = 120;
        if (c) c.value = 180;
        if (bw) bw.checked = true;
        updateCropperFilter();
    });

    document.getElementById('autoCropMagicBtn')?.addEventListener('click', () => {
        if (!state.cropper) return;
        const img = document.getElementById('cropperImage');
        if (!img) return;
        updateStatus("Detecting document edges...", "processing");
        setTimeout(() => {
            if (autoCropDocument(img, state.cropper)) updateStatus("Document auto-cropped successfully.", "success");
            else updateStatus("Auto crop failed. Please crop manually.", "error");
        }, 50);
    });

    document.getElementById('rotateLeftBtn')?.addEventListener('click', () => state.cropper && state.cropper.rotate(-90));
    document.getElementById('rotateRightBtn')?.addEventListener('click', () => state.cropper && state.cropper.rotate(90));
    document.getElementById('resetCropBtn')?.addEventListener('click', () => {
        if (state.cropper) state.cropper.reset();
        const b = document.getElementById('brightnessInput');
        const c = document.getElementById('contrastInput');
        const bw = document.getElementById('bwCheckbox');
        if (b) b.value = 100;
        if (c) c.value = 100;
        if (bw) bw.checked = false;
        updateCropperFilter();
    });
    
    document.getElementById('closeEditorBtn')?.addEventListener('click', closeEditor);
    document.getElementById('cancelEditorBtn')?.addEventListener('click', closeEditor);
    document.getElementById('closeGalleryModalBtn')?.addEventListener('click', () => document.getElementById('galleryModal')?.classList.add('hidden'));
    
    document.getElementById('saveEditorBtn')?.addEventListener('click', () => {
        if (!state.cropper || state.editingSlotIndex === -1) return;
        const croppedCanvas = state.cropper.getCroppedCanvas({ imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
        const brightness = document.getElementById('brightnessInput')?.value || 100;
        const contrast = document.getElementById('contrastInput')?.value || 100;
        const isBlackAndWhite = document.getElementById('bwCheckbox')?.checked || false;
        
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = croppedCanvas.width;
        finalCanvas.height = croppedCanvas.height;
        const ctx = finalCanvas.getContext('2d');
        
        Engine.applyFilters(ctx, { brightness, contrast, isBlackAndWhite });
        ctx.drawImage(croppedCanvas, 0, 0);
        
        state.slots[state.editingSlotIndex].image = finalCanvas.toDataURL('image/jpeg', 0.95);
        renderSlots();
        
        closeEditor();
    });
    
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportToPdf);
    document.getElementById('exportJpgBtn')?.addEventListener('click', exportToJpg);
    document.getElementById('printBtn')?.addEventListener('click', () => {
        updateStatus("પ્રિન્ટ ડાયલોગ ખોલી રહ્યા છીએ...", "ready");
        window.print();
    });
    
    window.addEventListener('beforeprint', () => {
        const container = document.getElementById('workspace-container');
        if (container) container.style.transform = 'scale(1)';
    });
    window.addEventListener('afterprint', () => resizeWorkspace());
});