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