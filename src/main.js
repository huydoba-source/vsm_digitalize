import { mount } from 'svelte'
import './index.css'
import App from './App.svelte'

// Hàm hiển thị thông báo lỗi trực tiếp lên màn hình nếu ứng dụng gặp sự cố
function renderError(message) {
  const appDiv = document.getElementById('app')
  if (appDiv && !appDiv.children.length) {
    appDiv.innerHTML = `
      <div style="padding: 24px; font-family: sans-serif; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; margin: 20px; border-radius: 8px;">
        <h3 style="margin-top:0;">Lỗi khởi chạy ứng dụng (JavaScript Error):</h3>
        <pre style="white-space: pre-wrap; word-break: break-all;">${message}</pre>
      </div>
    `
  }
}

// Bắt lỗi runtime/cú pháp thông thường
window.addEventListener('error', (event) => {
  renderError(event.message || String(event.error))
})

// Bắt lỗi Promise bị từ chối (Unhandled Promise Rejection)
window.addEventListener('unhandledrejection', (event) => {
  renderError(String(event.reason))
})

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app