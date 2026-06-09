/**
 * PDF Tools logic for merging and conversion.
 */

/**
 * PDF મર્જ કરવા માટેનું ફંક્શન
 */
export async function mergePDFs(files) {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();
    
    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    
    return await mergedPdf.save();
}

/**
 * ઈમેજીસને PDF માં કન્વર્ટ કરવા માટેનું ફંક્શન
 */
export async function convertImagesToPdf(files) {
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    
    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        let image;
        if (file.type === "image/png") {
            image = await pdfDoc.embedPng(arrayBuffer);
        } else {
            image = await pdfDoc.embedJpg(arrayBuffer);
        }
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    return await pdfDoc.save();
}

/**
 * PDF માંથી પસંદ કરેલ પેજ અલગ કરવા (By Range)
 */
export async function splitPdfByRange(file, pageIndices) {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach(page => newPdf.addPage(page));
    
    return await newPdf.save();
}

/**
 * PDF ના બધા પેજ અલગ કરી ZIP માં ડાઉનલોડ કરવા
 */
export async function splitPdfToZip(file, progressCallback) {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    const zip = new JSZip();
    const fileNameBase = file.name.replace(/\.[^/.]+$/, "");
    
    for (let i = 0; i < pageCount; i++) {
        if (progressCallback) progressCallback(i + 1, pageCount);
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
        const pdfBytes = await newPdf.save();
        zip.file(`${fileNameBase}_page_${i + 1}.pdf`, pdfBytes);
    }
    
    return await zip.generateAsync({ type: "blob" });
}

/**
 * PDF પેજને ફેરવવા માટે (Rotate Pages)
 * Preserves full quality without rasterization
 */
export async function rotatePdfPages(file, pageIndices, angleDelta) {
    const { PDFDocument, degrees } = PDFLib;
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    const pages = pdfDoc.getPages();
    if (pages.length === 0) throw new Error("Empty PDF document");
    
    const targetIndices = pageIndices && pageIndices.length > 0 ? pageIndices : pages.map((_, i) => i);
    
    for (const index of targetIndices) {
        if (index >= 0 && index < pages.length) {
            const page = pages[index];
            const currentAngle = page.getRotation().angle || 0;
            const newAngle = (currentAngle + angleDelta + 360) % 360;
            page.setRotation(degrees(newAngle));
        } else {
            throw new Error(`Invalid page range: Page ${index + 1} does not exist`);
        }
    }
    
    return await pdfDoc.save();
}

let pdfJsLoadingPromise = null;

/**
 * PDF માંથી પ્રથમ પેજનું થમ્બનેલ જનરેટ કરવા
 */
export async function getPdfThumbnail(file) {
    if (!window.pdfjsLib) {
        if (!pdfJsLoadingPromise) {
            pdfJsLoadingPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.onload = () => {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        await pdfJsLoadingPromise;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    try {
        const page = await pdf.getPage(1);
        
        // Force lightweight scale for mobile memory optimization
        const viewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(150 / viewport.width, 150 / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.8);
    } finally {
        await loadingTask.destroy();
    }
}