import { toPng } from 'html-to-image'

/**
 * Sanitize filename for safe download
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'download.png'
  }

  const sanitized = filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .substring(0, 255)

  if (!sanitized.includes('.')) {
    return sanitized + '.png'
  }

  return sanitized || 'download.png'
}

// BỔ SUNG: Hàm lọc để loại bỏ các nút điều khiển và Minimap khi xuất ảnh
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
 * Export canvas element as PNG file
 */
export async function exportAsPng(
  element,
  filename = 'vsm.png',
  options = {}
) {
  if (!element) {
    throw new Error('Element not found')
  }

  const safeFilename = sanitizeFilename(filename)
  const defaultOptions = {
    backgroundColor: '#ffffff', // BỔ SUNG: Chuyển nền thành màu trắng để hiển thị rõ nhất
    filter: filterNodes,        // BỔ SUNG: Gọi hàm lọc Minimap
    pixelRatio: 2,              // BỔ SUNG: Tăng độ sắc nét của ảnh
    quality: 1,
    ...options,
  }

  try {
    const dataUrl = await toPng(element, defaultOptions)
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = safeFilename
    link.click()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Failed to export PNG:', err)
    }
    throw new Error('Failed to export PNG')
  }
}