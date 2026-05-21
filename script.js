/**
 * QRcraft — script.js
 * Modular, production-quality QR Code Generator
 * No frameworks. Vanilla JS only.
 */

'use strict';

/* ============================================================
   CONFIG & STATE
   ============================================================ */

const CONFIG = {
  DEBOUNCE_MS: 280,
  MAX_CHARS: 2048,
  HISTORY_KEY: 'qrcraft_history',
  THEME_KEY: 'qrcraft_theme',
  MAX_HISTORY: 8,
  LOGO_SIZE_RATIO: 0.22,
  DEFAULT: {
    size: 256,
    fgColor: '#0a0a0f',
    bgColor: '#ffffff',
    ecLevel: 'M',
  },
};

const PRESETS = {
  url:   'https://example.com',
  email: 'mailto:hello@example.com',
  phone: 'tel:+15550001234',
  wifi:  'WIFI:T:WPA;S:MyNetwork;P:MyPassword;;',
};

const state = {
  value:      '',
  size:       CONFIG.DEFAULT.size,
  fgColor:    CONFIG.DEFAULT.fgColor,
  bgColor:    CONFIG.DEFAULT.bgColor,
  ecLevel:    CONFIG.DEFAULT.ecLevel,
  logoDataUrl: null,
  hasQR:      false,
  history:    [],
};

/* ============================================================
   DOM REFERENCES
   ============================================================ */

const $ = id => document.getElementById(id);

const dom = {
  qrInput:       $('qrInput'),
  charCount:     $('charCount'),
  inputWrap:     $('inputWrap'),
  inputError:    $('inputError'),
  qrSize:        $('qrSize'),
  sizeValue:     $('sizeValue'),
  fgColor:       $('fgColor'),
  bgColor:       $('bgColor'),
  fgHex:         $('fgHex'),
  bgHex:         $('bgHex'),
  swapColors:    $('swapColors'),
  ecTabs:        document.querySelectorAll('.ec-tab'),
  qrPlaceholder: $('qrPlaceholder'),
  qrCanvasWrap:  $('qrCanvasWrap'),
  qrCanvas:      $('qrCanvas'),
  qrLoading:     $('qrLoading'),
  downloadBtn:   $('downloadBtn'),
  copyBtn:       $('copyBtn'),
  metaChars:     $('metaChars'),
  metaSize:      $('metaSize'),
  metaLevel:     $('metaLevel'),
  themeToggle:   $('themeToggle'),
  iconMoon:      $('iconMoon'),
  iconSun:       $('iconSun'),
  logoDropZone:  $('logoDropZone'),
  logoFile:      $('logoFile'),
  uploadContent: $('uploadContent'),
  uploadPreview: $('uploadPreview'),
  logoPreviewImg:$('logoPreviewImg'),
  removeLogo:    $('removeLogo'),
  historySection:$('historySection'),
  historyList:   $('historyList'),
  clearHistory:  $('clearHistory'),
  presetChips:   document.querySelectorAll('.chip'),
  paletteSwatch: document.querySelectorAll('.palette-swatch'),
};

/* ============================================================
   QR GENERATION
   ============================================================ */

let debounceTimer = null;

/**
 * Debounced entry point for QR generation.
 */
function scheduleQRGeneration() {
  clearTimeout(debounceTimer);
  const value = dom.qrInput.value.trim();

  if (!value) {
    showPlaceholder();
    clearError();
    return;
  }

  showLoading();
  debounceTimer = setTimeout(() => generateQR(value), CONFIG.DEBOUNCE_MS);
}

/**
 * Core QR generation using qrcode-generator.
 */
function generateQR(value) {
  clearError();

  if (!validateInput(value)) {
    showPlaceholder();
    hideLoading();
    return;
  }

  try {
    // Build QR data
    const ecMap = { L: 'L', M: 'M', Q: 'Q', H: 'H' };
    const qr = qrcode(0, ecMap[state.ecLevel]);
    qr.addData(value);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const pixelSize   = state.size;
    const moduleSize  = Math.floor(pixelSize / moduleCount);
    const canvasSize  = moduleSize * moduleCount;
    const offset      = Math.floor((pixelSize - canvasSize) / 2);

    const canvas = dom.qrCanvas;
    canvas.width  = pixelSize;
    canvas.height = pixelSize;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, pixelSize, pixelSize);

    // Background
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, pixelSize, pixelSize);

    // Draw modules
    ctx.fillStyle = state.fgColor;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(
            offset + col * moduleSize,
            offset + row * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }

    // Draw logo overlay if present
    if (state.logoDataUrl) {
      drawLogoOverlay(ctx, pixelSize);
    } else {
      finalizeQR(value);
    }

  } catch (err) {
    console.error('QR generation error:', err);
    showError('Could not generate QR code. Try shortening the input or changing error correction level.');
    showPlaceholder();
    hideLoading();
  }
}

/**
 * Draw centered logo on canvas, then finalize.
 */
function drawLogoOverlay(ctx, canvasSize) {
  const img = new Image();
  img.onload = () => {
    const logoSize = Math.floor(canvasSize * CONFIG.LOGO_SIZE_RATIO);
    const logoX    = Math.floor((canvasSize - logoSize) / 2);
    const logoY    = Math.floor((canvasSize - logoSize) / 2);
    const padding  = Math.floor(logoSize * 0.12);

    // White pad behind logo
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(logoX - padding, logoY - padding, logoSize + padding * 2, logoSize + padding * 2);

    // Draw logo
    ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
    finalizeQR(state.value);
  };
  img.onerror = () => finalizeQR(state.value);
  img.src = state.logoDataUrl;
}

/**
 * Show canvas, update UI, add to history.
 */
function finalizeQR(value) {
  dom.qrPlaceholder.style.display = 'none';
  dom.qrCanvasWrap.style.display  = 'flex';
  dom.qrCanvasWrap.style.removeProperty('display');
  dom.qrCanvasWrap.style.display  = 'flex';
  hideLoading();

  state.hasQR = true;
  dom.downloadBtn.disabled = false;
  dom.copyBtn.disabled     = false;

  updateMeta(value);
  addToHistory(value);
}

/**
 * Update the metadata bar.
 */
function updateMeta(value) {
  dom.metaChars.textContent = value.length;
  dom.metaSize.textContent  = `${state.size}×${state.size}`;
  dom.metaLevel.textContent = state.ecLevel;
}

/* ============================================================
   VALIDATION
   ============================================================ */

function validateInput(value) {
  if (!value) {
    return false;
  }
  if (value.length > CONFIG.MAX_CHARS) {
    showError(`Input too long (${value.length}/${CONFIG.MAX_CHARS} chars).`);
    triggerShake();
    return false;
  }
  return true;
}

function showError(msg) {
  dom.inputError.textContent = msg;
  dom.inputError.classList.add('visible');
  dom.inputWrap.classList.add('error');
}

function clearError() {
  dom.inputError.textContent = '';
  dom.inputError.classList.remove('visible');
  dom.inputWrap.classList.remove('error');
}

function triggerShake() {
  dom.inputWrap.classList.remove('shake');
  void dom.inputWrap.offsetWidth; // reflow
  dom.inputWrap.classList.add('shake');
  dom.inputWrap.addEventListener('animationend', () => {
    dom.inputWrap.classList.remove('shake');
  }, { once: true });
}

/* ============================================================
   UI STATE HELPERS
   ============================================================ */

function showPlaceholder() {
  dom.qrPlaceholder.style.display   = 'flex';
  dom.qrCanvasWrap.style.display    = 'none';
  state.hasQR = false;
  dom.downloadBtn.disabled = true;
  dom.copyBtn.disabled     = true;
  dom.metaChars.textContent = '—';
  dom.metaSize.textContent  = '—';
  dom.metaLevel.textContent = state.ecLevel;
}

function showLoading() {
  dom.qrLoading.classList.add('active');
}

function hideLoading() {
  dom.qrLoading.classList.remove('active');
}

/* ============================================================
   DOWNLOAD
   ============================================================ */

function downloadQR() {
  if (!state.hasQR) return;

  const canvas   = dom.qrCanvas;
  const filename = sanitizeFilename(state.value);
  const dataUrl  = canvas.toDataURL('image/png', 1.0);

  const link     = document.createElement('a');
  link.download  = `qr-${filename}.png`;
  link.href      = dataUrl;
  link.click();

  // Visual feedback
  const btn = dom.downloadBtn;
  const original = btn.innerHTML;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="20 6 9 17 4 12"/></svg>
    Saved!
  `;
  setTimeout(() => { btn.innerHTML = original; }, 1800);
}

function sanitizeFilename(value) {
  return value
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 40)
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'qrcode';
}

/* ============================================================
   CLIPBOARD COPY
   ============================================================ */

async function copyQRToClipboard() {
  if (!state.hasQR) return;

  try {
    const canvas = dom.qrCanvas;
    canvas.toBlob(async blob => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        showCopySuccess();
      } catch {
        fallbackCopy();
      }
    }, 'image/png');
  } catch {
    fallbackCopy();
  }
}

function fallbackCopy() {
  // Copy the data URL to clipboard as text fallback
  const dataUrl = dom.qrCanvas.toDataURL('image/png');
  navigator.clipboard.writeText(dataUrl).catch(() => {});
  showCopySuccess();
}

function showCopySuccess() {
  const btn = dom.copyBtn;
  const origHTML = btn.innerHTML;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>
    Copied!
  `;
  btn.classList.add('copied');
  setTimeout(() => {
    btn.innerHTML = origHTML;
    btn.classList.remove('copied');
  }, 2000);
}

/* ============================================================
   HISTORY
   ============================================================ */

function loadHistory() {
  try {
    const raw = localStorage.getItem(CONFIG.HISTORY_KEY);
    state.history = raw ? JSON.parse(raw) : [];
  } catch {
    state.history = [];
  }
  renderHistory();
}

function addToHistory(value) {
  if (!value) return;

  // Remove duplicate
  state.history = state.history.filter(h => h.value !== value);

  // Prepend
  state.history.unshift({
    value,
    time: Date.now(),
    size: state.size,
    fgColor: state.fgColor,
    bgColor: state.bgColor,
    ecLevel: state.ecLevel,
  });

  // Cap
  if (state.history.length > CONFIG.MAX_HISTORY) {
    state.history = state.history.slice(0, CONFIG.MAX_HISTORY);
  }

  saveHistory();
  renderHistory();
}

function saveHistory() {
  try {
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(state.history));
  } catch { /* Storage unavailable */ }
}

function renderHistory() {
  if (!state.history.length) {
    dom.historySection.style.display = 'none';
    return;
  }

  dom.historySection.style.display = 'block';
  dom.historyList.innerHTML = '';

  state.history.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.setAttribute('tabindex', '0');
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', `Restore: ${item.value}`);

    // Mini QR thumb
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'history-thumb';
    const thumbCanvas = buildThumbCanvas(item);
    if (thumbCanvas) thumbWrap.appendChild(thumbCanvas);

    // Text
    const textDiv = document.createElement('div');
    textDiv.className = 'history-text';

    const contentSpan = document.createElement('div');
    contentSpan.className = 'history-content';
    contentSpan.textContent = item.value;

    const timeSpan = document.createElement('div');
    timeSpan.className = 'history-time';
    timeSpan.textContent = formatRelativeTime(item.time);

    textDiv.append(contentSpan, timeSpan);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'history-del';
    delBtn.setAttribute('aria-label', 'Remove from history');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      removeHistoryItem(idx);
    });

    li.append(thumbWrap, textDiv, delBtn);

    // Click to restore
    li.addEventListener('click', () => restoreHistoryItem(item));
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        restoreHistoryItem(item);
      }
    });

    dom.historyList.appendChild(li);
  });
}

function buildThumbCanvas(item) {
  try {
    const size = 32;
    const qr = qrcode(0, item.ecLevel || 'M');
    qr.addData(item.value);
    qr.make();

    const mc = qr.getModuleCount();
    const ms = Math.floor(size / mc);
    const cs = ms * mc;
    const off = Math.floor((size - cs) / 2);

    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = item.bgColor || '#ffffff';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = item.fgColor || '#000000';
    for (let r = 0; r < mc; r++) {
      for (let c = 0; c < mc; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(off + c * ms, off + r * ms, ms, ms);
        }
      }
    }
    return canvas;
  } catch {
    return null;
  }
}

function restoreHistoryItem(item) {
  dom.qrInput.value = item.value;
  state.size       = item.size      || CONFIG.DEFAULT.size;
  state.fgColor    = item.fgColor   || CONFIG.DEFAULT.fgColor;
  state.bgColor    = item.bgColor   || CONFIG.DEFAULT.bgColor;
  state.ecLevel    = item.ecLevel   || CONFIG.DEFAULT.ecLevel;

  // Sync UI controls
  dom.qrSize.value        = state.size;
  dom.sizeValue.textContent = `${state.size} px`;
  dom.fgColor.value       = state.fgColor;
  dom.bgColor.value       = state.bgColor;
  dom.fgHex.textContent   = state.fgColor;
  dom.bgHex.textContent   = state.bgColor;
  setECLevel(state.ecLevel);
  updateCharCount();

  state.value = item.value;
  generateQR(item.value);
}

function removeHistoryItem(idx) {
  state.history.splice(idx, 1);
  saveHistory();
  renderHistory();
}

function clearAllHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ============================================================
   THEME
   ============================================================ */

function loadTheme() {
  const saved = localStorage.getItem(CONFIG.THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  dom.iconMoon.style.display = isDark ? 'block' : 'none';
  dom.iconSun.style.display  = isDark ? 'none' : 'block';
  try { localStorage.setItem(CONFIG.THEME_KEY, theme); } catch {}
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ============================================================
   LOGO UPLOAD
   ============================================================ */

function handleLogoFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = e => {
    state.logoDataUrl = e.target.result;
    dom.logoPreviewImg.src = state.logoDataUrl;
    dom.uploadContent.style.display  = 'none';
    dom.uploadPreview.style.display  = 'flex';

    // Auto-set H error correction for logo
    if (state.ecLevel !== 'H') {
      setECLevel('H');
    }

    if (state.value) generateQR(state.value);
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  state.logoDataUrl = null;
  dom.logoFile.value = '';
  dom.uploadPreview.style.display  = 'none';
  dom.uploadContent.style.display  = 'flex';
  if (state.value) generateQR(state.value);
}

/* ============================================================
   ERROR CORRECTION
   ============================================================ */

function setECLevel(level) {
  state.ecLevel = level;
  dom.ecTabs.forEach(tab => {
    const isActive = tab.dataset.level === level;
    tab.setAttribute('aria-checked', isActive ? 'true' : 'false');
    tab.classList.toggle('active', isActive);
  });
  dom.metaLevel.textContent = level;
}

/* ============================================================
   CHAR COUNT
   ============================================================ */

function updateCharCount() {
  const len = dom.qrInput.value.length;
  dom.charCount.textContent = `${len} / ${CONFIG.MAX_CHARS}`;
  dom.charCount.classList.remove('warn', 'danger');
  if (len > CONFIG.MAX_CHARS * 0.9) {
    dom.charCount.classList.add('danger');
  } else if (len > CONFIG.MAX_CHARS * 0.7) {
    dom.charCount.classList.add('warn');
  }
}

/* ============================================================
   EVENT BINDING
   ============================================================ */

function bindEvents() {

  /* --- Input --- */
  dom.qrInput.addEventListener('input', () => {
    state.value = dom.qrInput.value.trim();
    updateCharCount();
    scheduleQRGeneration();
  });

  dom.qrInput.addEventListener('paste', () => {
    requestAnimationFrame(() => {
      state.value = dom.qrInput.value.trim();
      updateCharCount();
      scheduleQRGeneration();
    });
  });

  /* --- Preset chips --- */
  dom.presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = PRESETS[chip.dataset.preset];
      if (preset) {
        dom.qrInput.value = preset;
        state.value = preset;
        updateCharCount();
        scheduleQRGeneration();
        dom.qrInput.focus();
      }
    });
  });

  /* --- Size slider --- */
  dom.qrSize.addEventListener('input', () => {
    state.size = parseInt(dom.qrSize.value, 10);
    dom.sizeValue.textContent = `${state.size} px`;
    dom.qrSize.setAttribute('aria-valuenow', state.size);
    if (state.value) scheduleQRGeneration();
  });

  /* --- Color pickers --- */
  dom.fgColor.addEventListener('input', () => {
    state.fgColor = dom.fgColor.value;
    dom.fgHex.textContent = state.fgColor;
    if (state.value) scheduleQRGeneration();
  });

  dom.bgColor.addEventListener('input', () => {
    state.bgColor = dom.bgColor.value;
    dom.bgHex.textContent = state.bgColor;
    if (state.value) scheduleQRGeneration();
  });

  /* --- Swap colors --- */
  dom.swapColors.addEventListener('click', () => {
    const tmp       = state.fgColor;
    state.fgColor   = state.bgColor;
    state.bgColor   = tmp;
    dom.fgColor.value      = state.fgColor;
    dom.bgColor.value      = state.bgColor;
    dom.fgHex.textContent  = state.fgColor;
    dom.bgHex.textContent  = state.bgColor;
    if (state.value) scheduleQRGeneration();
  });

  /* --- Palette swatches --- */
  dom.paletteSwatch.forEach(swatch => {
    swatch.addEventListener('click', () => {
      state.fgColor = swatch.dataset.fg;
      state.bgColor = swatch.dataset.bg;
      dom.fgColor.value      = state.fgColor;
      dom.bgColor.value      = state.bgColor;
      dom.fgHex.textContent  = state.fgColor;
      dom.bgHex.textContent  = state.bgColor;
      dom.paletteSwatch.forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      if (state.value) scheduleQRGeneration();
    });
  });

  /* --- Error Correction --- */
  dom.ecTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setECLevel(tab.dataset.level);
      if (state.value) scheduleQRGeneration();
    });
    tab.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tab.click();
      }
    });
  });

  /* --- Download --- */
  dom.downloadBtn.addEventListener('click', downloadQR);

  /* --- Copy --- */
  dom.copyBtn.addEventListener('click', copyQRToClipboard);

  /* --- Theme toggle --- */
  dom.themeToggle.addEventListener('click', toggleTheme);

  /* --- Logo upload --- */
  dom.logoFile.addEventListener('change', () => {
    const file = dom.logoFile.files[0];
    if (file) handleLogoFile(file);
  });

  // Drag and drop
  dom.logoDropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dom.logoDropZone.classList.add('drag-over');
  });

  dom.logoDropZone.addEventListener('dragleave', () => {
    dom.logoDropZone.classList.remove('drag-over');
  });

  dom.logoDropZone.addEventListener('drop', e => {
    e.preventDefault();
    dom.logoDropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleLogoFile(file);
  });

  dom.logoDropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dom.logoFile.click();
    }
  });

  dom.removeLogo.addEventListener('click', e => {
    e.stopPropagation();
    removeLogo();
  });

  /* --- History --- */
  dom.clearHistory.addEventListener('click', clearAllHistory);

  /* --- Keyboard shortcut: Cmd/Ctrl+Enter to download --- */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      downloadQR();
    }
  });

  /* --- Responsive: rerender on resize --- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.value && state.hasQR) generateQR(state.value);
    }, 400);
  });
}

/* ============================================================
   INITIAL SYNC
   ============================================================ */

function syncInitialUI() {
  dom.qrSize.value          = state.size;
  dom.sizeValue.textContent = `${state.size} px`;
  dom.fgColor.value         = state.fgColor;
  dom.bgColor.value         = state.bgColor;
  dom.fgHex.textContent     = state.fgColor;
  dom.bgHex.textContent     = state.bgColor;
  setECLevel(state.ecLevel);
  updateCharCount();
}

/* ============================================================
   INIT
   ============================================================ */

function init() {
  loadTheme();
  syncInitialUI();
  loadHistory();
  bindEvents();

  // Autofocus input on desktop
  if (window.innerWidth >= 900) {
    dom.qrInput.focus();
  }
}

document.addEventListener('DOMContentLoaded', init);
