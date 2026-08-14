import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

const PDF_ORIENTATION = 'landscape'

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'download.pdf'
  }

  const sanitized = filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .substring(0, 255)

  if (!sanitized.endsWith('.pdf')) {
    return sanitized.replace(/\.[^.]*$/, '') + '.pdf'
  }

  return sanitized || 'download.pdf'
}

// BỔ SUNG: Hàm lọc để loại bỏ các nút điều khiển và Minimap khi xuất PDF
const filterNodes = (node) => {
  if (node?.classList) {
    const excludeClasses = ['svelte-flow__minimap', 'svelte-flow__controls', 'svelte-flow__panel'];
    if (excludeClasses.some(c => node.classList.contains(c))) {
      return false;
    }
  }
  return true;
};

/**
 * Export canvas element as PDF file
 */
export async function exportAsPdf(
  element,
  filename = 'vsm.pdf',
  options = {}
) {
  if (!element) {
    throw new Error('Element not found')
  }

  const safeFilename = sanitizeFilename(filename)
  const defaultOptions = {
    backgroundColor: '#ffffff', // BỔ SUNG: Chuyển nền thành màu trắng
    filter: filterNodes,        // BỔ SUNG: Gọi hàm lọc Minimap
    pixelRatio: 2,              // BỔ SUNG: Tăng độ sắc nét
    quality: 1,
    ...options,
  }

  try {
    const dataUrl = await toPng(element, defaultOptions)
    const pdf = new jsPDF({
      orientation: PDF_ORIENTATION,
      unit: 'px',
    })
    const imgProps = pdf.getImageProperties(dataUrl)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(safeFilename)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Failed to export PDF:', err)
    }
    throw new Error('Failed to export PDF')
  }
}