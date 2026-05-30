/**
 * Core Image Engine - GovDocs Pro
 * Handles high-performance image manipulation and compression
 */

/**
 * Iteratively adjusts JPEG quality to hit a specific KB target
 */
export async function compressToTargetKB(canvas, minKb, maxKb, format = 'image/jpeg') {
    if (format === 'image/png') {
        return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    let quality = 0.9;
    let min = 0.01;
    let max = 1.0;
    let blob = null;
    const targetMin = minKb * 1024;
    const targetMax = maxKb * 1024;

    // Binary search for quality (max 8 iterations for performance)
    for (let i = 0; i < 8; i++) {
        quality = (min + max) / 2;
        blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
        
        if (blob.size > targetMax) {
            max = quality;
        } else if (blob.size < targetMin) {
            min = quality;
        } else {
            break; 
        }
    }
    return blob;
}

/**
 * Resizes a source (canvas or image) to target dimensions using Canvas API
 */
export function resizeImage(source, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, width, height);
    return canvas;
}

/**
 * Applies filters to a canvas context
 */
export function applyFilters(ctx, { brightness, contrast, isBlackAndWhite }) {
    let filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (isBlackAndWhite) {
        filter += ` grayscale(100%) contrast(1000%)`;
    }
    ctx.filter = filter;
}

/**
 * Generates a standard 4x6 print sheet (8 photos)
 */
export async function createPrintSheet(sourceCanvas) {
    // 4x6 Inch at 300 DPI = 1200x1800 pixels
    const sheet = document.createElement('canvas');
    sheet.width = 1800;
    sheet.height = 1200;
    const ctx = sheet.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, sheet.width, sheet.height);

    // Calculations for 8 photos (2 rows, 4 columns)
    const pWidth = 400; 
    const pHeight = (sourceCanvas.height / sourceCanvas.width) * pWidth;
    const gap = 40;

    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 4; j++) {
            ctx.drawImage(sourceCanvas, j * (pWidth + gap) + gap, i * (pHeight + gap) + gap, pWidth, pHeight);
        }
    }

    return new Promise(resolve => {
        sheet.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `print_sheet_4x6.jpg`;
            link.click();
            // Cleanup
            setTimeout(() => URL.revokeObjectURL(url), 100);
            resolve();
        }, 'image/jpeg', 0.9);
    });
}