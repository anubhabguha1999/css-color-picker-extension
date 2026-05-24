/* ==========================================
   ChromaLux CSS Color Picker - Extension Logic
   ========================================== */

// Default starter color (Indigo)
let activeColor = '#6366F1';
let historyColors = [];
let activeTheme = 'dark';
let activeContrastBg = '#1E293B'; // Default dark option

// Hybrid Storage Helper (chrome.storage.local with localStorage fallback for testing)
const storage = {
  async get(key) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
          });
        });
      } else {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
      }
    } catch (e) {
      console.warn("Storage read failed, using memory fallback", e);
      return null;
    }
  },
  async set(key, value) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve();
          });
        });
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  }
};

// DOM Elements
const elements = {
  themeToggle: document.getElementById('theme-toggle'),
  pickBtn: document.getElementById('pick-btn'),
  colorPreviewBadge: document.getElementById('color-preview-badge'),
  cardGlow: document.getElementById('card-glow'),
  colorHexLarge: document.getElementById('color-hex-large'),
  
  // Format Inputs
  formatHex: document.getElementById('format-hex'),
  formatRgb: document.getElementById('format-rgb'),
  formatHsl: document.getElementById('format-hsl'),
  formatOklch: document.getElementById('format-oklch'),
  
  // Containers
  tintsShadesRow: document.getElementById('tints-shades-row'),
  harmonyComplementary: document.getElementById('harmony-complementary'),
  harmonyAnalogous: document.getElementById('harmony-analogous'),
  harmonyTriadic: document.getElementById('harmony-triadic'),
  harmonySplit: document.getElementById('harmony-split'),
  
  // Contrast Panel
  contrastPreviewCard: document.getElementById('contrast-preview-card'),
  contrastPreviewText: document.getElementById('contrast-preview-text'),
  bgOptDark: document.getElementById('bg-opt-dark'),
  bgOptLight: document.getElementById('bg-opt-light'),
  contrastCustomBg: document.getElementById('contrast-custom-bg'),
  customBgIndicator: document.getElementById('custom-bg-indicator'),
  contrastRatioValue: document.getElementById('contrast-ratio-value'),
  badgeNormalAA: document.getElementById('badge-normal-aa'),
  badgeNormalAAA: document.getElementById('badge-normal-aaa'),
  badgeLargeAA: document.getElementById('badge-large-aa'),
  badgeLargeAAA: document.getElementById('badge-large-aaa'),
  
  // History Panel
  historyCount: document.getElementById('history-count'),
  historyGrid: document.getElementById('history-grid'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),
  noHistoryMsg: document.getElementById('no-history-msg'),
  
  // Global Navbar Items
  navItems: document.querySelectorAll('.nav-item'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  
  // Copy Buttons & Toast
  copyButtons: document.querySelectorAll('.copy-btn'),
  toast: document.getElementById('toast')
};

/* ==================== COLOR MATH FUNCTIONS ==================== */

// HEX to RGB
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// RGB to HEX
function rgbToHex(r, g, b) {
  const toHex = c => {
    const hex = Math.max(0, Math.min(255, c)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// RGB to HSL
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// HSL to RGB
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, (h / 360) + 1/3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, (h / 360) - 1/3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

// RGB to OKLCH (Exact Björn Ottosson implementation)
function rgbToOklch(r, g, b) {
  // 1. Linearize sRGB
  const linearize = c => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const rL = linearize(r);
  const gL = linearize(g);
  const bL = linearize(b);

  // 2. Linear sRGB to LMS
  const l = Math.cbrt(0.4122214708 * rL + 0.5363325363 * gL + 0.0514459929 * bL);
  const m = Math.cbrt(0.2119034982 * rL + 0.6806995451 * gL + 0.1073969566 * bL);
  const s = Math.cbrt(0.0883024619 * rL + 0.2817188376 * gL + 0.6299787005 * bL);

  // 3. LMS to Oklab
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bLab = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

  // 4. Oklab to Oklch
  const C = Math.sqrt(a * a + bLab * bLab);
  let hRad = Math.atan2(bLab, a);
  let h = hRad >= 0 ? (hRad * 180 / Math.PI) : (hRad * 180 / Math.PI + 360);

  return {
    l: parseFloat(L.toFixed(3)),
    c: parseFloat(C.toFixed(3)),
    h: Math.round(h)
  };
}

// Helper to check if a color is Light (useful for text readability overlays)
function isLightColor(r, g, b) {
  // Standard HSP color model equation for perceived brightness
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  return hsp > 155;
}

/* ==================== WCAG CONTRAST SYSTEM ==================== */

// Get relative luminance of a color
function getRelativeLuminance(r, g, b) {
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;
  
  const R = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const G = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const B = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
  
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Calculate contrast ratio between two relative luminances
function getContrastRatio(lum1, lum2) {
  const bright = Math.max(lum1, lum2);
  const dark = Math.min(lum1, lum2);
  return (bright + 0.05) / (dark + 0.05);
}

// Update accessibility evaluations on contrast panel
function updateContrastUI(rgbPicked) {
  const rgbBg = hexToRgb(activeContrastBg);
  
  const lumPicked = getRelativeLuminance(rgbPicked.r, rgbPicked.g, rgbPicked.b);
  const lumBg = getRelativeLuminance(rgbBg.r, rgbBg.g, rgbBg.b);
  
  const ratio = getContrastRatio(lumPicked, lumBg);
  
  // Update Preview Box
  elements.contrastPreviewCard.style.backgroundColor = activeContrastBg;
  elements.contrastPreviewText.style.color = activeColor;
  
  // Update score label
  elements.contrastRatioValue.innerText = `${ratio.toFixed(2)}:1`;
  
  // Normal Text Badges (AA requires 4.5, AAA requires 7.0)
  updateBadgeState(elements.badgeNormalAA, ratio >= 4.5);
  updateBadgeState(elements.badgeNormalAAA, ratio >= 7.0);
  
  // Large Text Badges (AA requires 3.0, AAA requires 4.5)
  updateBadgeState(elements.badgeLargeAA, ratio >= 3.0);
  updateBadgeState(elements.badgeLargeAAA, ratio >= 4.5);
}

function updateBadgeState(badgeElement, isPass) {
  if (isPass) {
    badgeElement.innerText = 'PASS';
    badgeElement.className = 'badge aa-badge pass';
  } else {
    badgeElement.innerText = 'FAIL';
    badgeElement.className = 'badge aa-badge fail';
  }
}

/* ==================== STATE MANAGEMENT ==================== */

// Main State Updater
function updateActiveColor(newHex, saveToHistory = true) {
  // Clean inputs
  if (!newHex.startsWith('#')) newHex = '#' + newHex;
  activeColor = newHex.toUpperCase();
  
  // Convert
  const rgb = hexToRgb(activeColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);
  
  // 1. Update Preview & Brand Styles
  elements.colorPreviewBadge.style.backgroundColor = activeColor;
  elements.cardGlow.style.background = activeColor;
  elements.colorHexLarge.innerText = activeColor;
  
  // Update CSS accent dynamically!
  document.documentElement.style.setProperty('--accent', activeColor);
  
  // Calculate subtle glow color matching current hue
  const rgbGlowStr = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
  document.documentElement.style.setProperty('--accent-glow', rgbGlowStr);
  
  // Adjust hover states
  const darkHsl = `hsl(${hsl.h}, ${hsl.s}%, ${Math.max(10, hsl.l - 12)}%)`;
  document.documentElement.style.setProperty('--accent-hover', darkHsl);

  // 2. Update Formats inputs
  elements.formatHex.value = activeColor;
  elements.formatRgb.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  elements.formatHsl.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  elements.formatOklch.value = `oklch(${oklch.l} ${oklch.c} ${oklch.h})`;

  // 3. Generate Shades & Tints
  renderShadesAndTints(rgb);

  // 4. Generate Harmonies
  renderHarmonies(hsl);

  // 5. Update Accessibility contrast
  updateContrastUI(rgb);

  // 6. Save to Storage (if requested)
  if (saveToHistory) {
    addHistoryItem(activeColor);
  }
}

/* ==================== RENDER COMPONENT UI ==================== */

// Tint & Shade mixing logic
function renderShadesAndTints(rgb) {
  elements.tintsShadesRow.innerHTML = '';
  
  const swatches = [];
  
  // 3 Shades (mix towards Black #000)
  for (let i = 3; i >= 1; i--) {
    const factor = i * 0.22;
    const r = Math.round(rgb.r * (1 - factor));
    const g = Math.round(rgb.g * (1 - factor));
    const b = Math.round(rgb.b * (1 - factor));
    swatches.push(rgbToHex(r, g, b));
  }
  
  // 1 Original Middle
  swatches.push(activeColor);
  
  // 3 Tints (mix towards White #FFF)
  for (let i = 1; i <= 3; i++) {
    const factor = i * 0.22;
    const r = Math.round(rgb.r + (255 - rgb.r) * factor);
    const g = Math.round(rgb.g + (255 - rgb.g) * factor);
    const b = Math.round(rgb.b + (255 - rgb.b) * factor);
    swatches.push(rgbToHex(r, g, b));
  }

  // Draw elements
  swatches.forEach(hex => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch-item' + (hex === activeColor ? ' active' : '');
    swatch.style.backgroundColor = hex;
    swatch.title = hex;
    
    swatch.addEventListener('click', () => {
      updateActiveColor(hex, true);
    });
    
    elements.tintsShadesRow.appendChild(swatch);
  });
}

// Generate Palette rows
function renderHarmonies(hsl) {
  // Harmony Scheme Config
  const schemes = [
    {
      container: elements.harmonyComplementary,
      offsets: [0, 180]
    },
    {
      container: elements.harmonyAnalogous,
      offsets: [-30, 0, 30]
    },
    {
      container: elements.harmonyTriadic,
      offsets: [0, 120, 240]
    },
    {
      container: elements.harmonySplit,
      offsets: [0, 150, 210]
    }
  ];

  schemes.forEach(scheme => {
    scheme.container.innerHTML = '';
    
    scheme.offsets.forEach(offset => {
      const targetHue = (hsl.h + offset + 360) % 360;
      // Convert back to HEX
      const rgb = hslToRgb(targetHue, hsl.s, hsl.l);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      
      const swatch = document.createElement('div');
      swatch.className = 'harmony-swatch';
      swatch.style.backgroundColor = hex;
      
      // Is Light or Dark swatch (adjust hex visual contrast inside swatch)
      const hexLabel = document.createElement('span');
      hexLabel.className = 'harmony-hex';
      hexLabel.innerText = hex;
      
      if (isLightColor(rgb.r, rgb.g, rgb.b)) {
        hexLabel.style.color = '#000000';
        hexLabel.style.background = 'rgba(255, 255, 255, 0.6)';
      }
      
      swatch.appendChild(hexLabel);
      
      swatch.addEventListener('click', () => {
        updateActiveColor(hex, true);
        showToast(`Copied & Loaded: ${hex}`);
      });
      
      scheme.container.appendChild(swatch);
    });
  });
}

// Add Item to History Array and Render
async function addHistoryItem(hex) {
  // Filter duplicates
  historyColors = historyColors.filter(c => c !== hex);
  // Put at the front
  historyColors.unshift(hex);
  // Limit to 20
  if (historyColors.length > 20) {
    historyColors.pop();
  }
  
  await storage.set('history', historyColors);
  renderHistory();
}

function renderHistory() {
  // Clean all previous grids
  const swatchCards = elements.historyGrid.querySelectorAll('.history-card');
  swatchCards.forEach(c => c.remove());
  
  if (historyColors.length === 0) {
    elements.noHistoryMsg.classList.remove('hidden');
    elements.historyCount.innerText = '0 colors saved';
    return;
  }
  
  elements.noHistoryMsg.classList.add('hidden');
  elements.historyCount.innerText = `${historyColors.length} ${historyColors.length === 1 ? 'color' : 'colors'} saved`;
  
  historyColors.forEach(hex => {
    const card = document.createElement('div');
    card.className = 'history-card';
    
    const badge = document.createElement('div');
    badge.className = 'history-swatch-badge';
    badge.style.backgroundColor = hex;
    badge.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,0.06)`;
    
    const label = document.createElement('span');
    label.className = 'history-hex-label';
    label.innerText = hex;
    
    // Delete visual icon
    const delBtn = document.createElement('button');
    delBtn.className = 'history-del-btn';
    delBtn.title = 'Remove';
    delBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Avoid loading color
      historyColors = historyColors.filter(c => c !== hex);
      await storage.set('history', historyColors);
      renderHistory();
      showToast('Removed from history');
    });
    
    card.appendChild(badge);
    card.appendChild(label);
    card.appendChild(delBtn);
    
    card.addEventListener('click', () => {
      updateActiveColor(hex, false);
      showToast(`Loaded: ${hex}`);
    });
    
    elements.historyGrid.appendChild(card);
  });
}

/* ==================== GLOBAL CONTROLS & INTERFACES ==================== */

// Global Toast Popup Trigger
let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.innerText = message;
  elements.toast.classList.remove('hidden');
  
  toastTimeout = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 1600);
}

// Clipboard copying with visual double-feedback
function handleCopyEvent(cardElement) {
  const input = cardElement.querySelector('.format-input');
  const copyBtn = cardElement.querySelector('.copy-btn');
  const copySvg = copyBtn.querySelector('.copy-svg');
  const checkSvg = copyBtn.querySelector('.check-svg');
  const textVal = input.value;
  
  navigator.clipboard.writeText(textVal).then(() => {
    // 1. Trigger global toast
    showToast(`Copied: ${textVal}`);
    
    // 2. Trigger local checkmark flip
    copySvg.classList.add('hidden');
    checkSvg.classList.remove('hidden');
    
    setTimeout(() => {
      checkSvg.classList.add('hidden');
      copySvg.classList.remove('hidden');
    }, 1500);
  }).catch(err => {
    console.error("Clipboard copy failed", err);
    // Fallback using text selection
    try {
      input.select();
      document.execCommand('copy');
      showToast(`Selected & Copied!`);
    } catch(e) {
      showToast("Failed to copy automatically.");
    }
  });
}

// Webpage Eyedropper Script Injection Launcher
async function launchEyeDropper() {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        runLocalEyeDropper();
        return;
      }
      
      // Prevent injecting into system pages (chrome://, edge://, etc.) where injection is blocked by security
      if (tab.url && (
        tab.url.startsWith('chrome://') || 
        tab.url.startsWith('edge://') || 
        tab.url.startsWith('about:') || 
        tab.url.startsWith('https://chrome.google.com') ||
        tab.url.startsWith('https://chromewebstore.google.com')
      )) {
        showToast("System page: picking color locally.");
        runLocalEyeDropper();
        return;
      }
      
      // Inject our pick color function into the active web tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectedPickColor
      });
      
      // Close the popup so the user can see and click on the website!
      window.close();
      
    } catch (err) {
      console.warn("Failed to inject script, fallback to local picker:", err);
      runLocalEyeDropper();
    }
  } else {
    // Fallback if running outside of extension context (e.g. testing popup directly in standard browser)
    runLocalEyeDropper();
  }
}

// Local Eyedropper fallback (runs inside the popup)
async function runLocalEyeDropper() {
  if (typeof EyeDropper === 'undefined') {
    showToast("Eyedropper API not supported in this browser context.");
    return;
  }
  
  const eyeDropper = new EyeDropper();
  elements.pickBtn.style.transform = 'scale(0.95)';
  
  try {
    const result = await eyeDropper.open();
    if (result && result.sRGBHex) {
      updateActiveColor(result.sRGBHex, true);
      showToast(`Picked: ${result.sRGBHex.toUpperCase()}`);
    }
  } catch (err) {
    console.log("User canceled color picking or Eyedropper error:", err);
  } finally {
    elements.pickBtn.style.transform = '';
  }
}

// THIS FUNCTION IS INJECTED & EXECUTES INSIDE THE WEBPAGE
async function injectedPickColor() {
  if (typeof EyeDropper === 'undefined') {
    alert("EyeDropper API is not supported on this website.");
    return;
  }
  
  const eyeDropper = new EyeDropper();
  try {
    const result = await eyeDropper.open();
    if (result && result.sRGBHex) {
      const pickedHex = result.sRGBHex.toUpperCase();
      
      // Save color to extension storage
      chrome.storage.local.get({ history: [], activeColor: '#6366F1' }, (data) => {
        let history = data.history || [];
        history = history.filter(c => c !== pickedHex);
        history.unshift(pickedHex);
        if (history.length > 20) history.pop();
        
        chrome.storage.local.set({
          activeColor: pickedHex,
          history: history
        }, () => {
          // Render beautiful notification inside the active tab
          showWebpageNotification(pickedHex);
        });
      });
    }
  } catch (e) {
    console.log("EyeDropper closed or failed:", e);
  }

  // Floating notification overlay helper
  function showWebpageNotification(hex) {
    const existing = document.getElementById('chromalux-web-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'chromalux-web-toast';
    toast.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      background: #0B0F19 !important;
      color: #F3F4F6 !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      padding: 12px 18px !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      z-index: 2147483647 !important;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
      opacity: 0 !important;
      transform: translateY(10px) !important;
    `;
    
    const colorIndicator = document.createElement('span');
    colorIndicator.style.cssText = `
      width: 16px !important;
      height: 16px !important;
      border-radius: 4px !important;
      background-color: ${hex} !important;
      border: 1px solid rgba(255,255,255,0.15) !important;
      display: inline-block !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
    `;
    
    const text = document.createElement('span');
    text.innerText = `ChromaLux Picked: ${hex}`;
    
    const copyBtn = document.createElement('button');
    copyBtn.innerText = 'Copy';
    copyBtn.style.cssText = `
      background: #6366F1 !important;
      color: #ffffff !important;
      border: none !important;
      padding: 5px 12px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      transition: all 0.2s ease !important;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3) !important;
    `;
    
    copyBtn.addEventListener('mouseover', () => {
      copyBtn.style.background = '#4F46E5';
    });
    copyBtn.addEventListener('mouseout', () => {
      copyBtn.style.background = '#6366F1';
    });
    
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(hex).then(() => {
        copyBtn.innerText = 'Copied!';
        copyBtn.style.background = '#10B981';
        copyBtn.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
          setTimeout(() => toast.remove(), 300);
        }, 800);
      });
    });
    
    toast.appendChild(colorIndicator);
    toast.appendChild(text);
    toast.appendChild(copyBtn);
    
    document.body.appendChild(toast);
    
    // Force reflow and animate in
    toast.offsetHeight;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    // Auto remove after 5 seconds if not clicked
    setTimeout(() => {
      if (document.body.contains(toast) && copyBtn.innerText !== 'Copied!') {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  }
}

// Initialize Application Settings
async function initApp() {
  // 1. Load Theme Mode
  const savedTheme = await storage.get('theme');
  if (savedTheme) {
    activeTheme = savedTheme;
  } else {
    // Check system preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    activeTheme = prefersDark ? 'dark' : 'light';
  }
  setTheme(activeTheme);

  // 2. Load History Log
  const savedHistory = await storage.get('history');
  if (savedHistory && Array.isArray(savedHistory)) {
    historyColors = savedHistory;
  }
  renderHistory();

  // 3. Load Active Color (Defaults to Indigo if nothing was saved)
  const savedActiveColor = await storage.get('activeColor');
  if (savedActiveColor) {
    updateActiveColor(savedActiveColor, false);
  } else {
    updateActiveColor(activeColor, false);
  }
}

// Set Theme state
function setTheme(theme) {
  activeTheme = theme;
  document.body.className = `${theme}-theme`;
  storage.set('theme', theme);
  
  // Update header color styles and toggle state
  if (theme === 'dark') {
    elements.themeToggle.title = 'Switch to Light Theme';
  } else {
    elements.themeToggle.title = 'Switch to Dark Theme';
  }
}

/* ==================== BIND EVENT LISTENERS ==================== */

// Theme button
elements.themeToggle.addEventListener('click', () => {
  const targetTheme = activeTheme === 'dark' ? 'light' : 'dark';
  setTheme(targetTheme);
  
  // Sync the contrast preview card background if user has not picked a custom one
  const isDarkSelected = elements.bgOptDark.classList.contains('active');
  const isLightSelected = elements.bgOptLight.classList.contains('active');
  
  if (isDarkSelected && targetTheme === 'light') {
    // Switch contrast background to light for readability or leave as-is? Let's leave as is, since they selected it.
  }
});

// Eyedropper triggers
elements.pickBtn.addEventListener('click', launchEyeDropper);
elements.colorPreviewBadge.addEventListener('click', launchEyeDropper);

// Bind Tab Bar Navigation
elements.navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetTab = item.getAttribute('data-tab');
    
    // Toggle nav active classes
    elements.navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    
    // Toggle active panel
    elements.tabPanels.forEach(panel => {
      if (panel.id === `tab-${targetTab}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  });
});

// Copy button card hooks
elements.copyButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const card = e.currentTarget.closest('.format-card');
    handleCopyEvent(card);
  });
});

// Double click to copy inputs directly
document.querySelectorAll('.format-input').forEach(input => {
  input.addEventListener('click', (e) => {
    const card = e.currentTarget.closest('.format-card');
    handleCopyEvent(card);
  });
});

// Contrast Background Options
elements.bgOptDark.addEventListener('click', () => {
  elements.bgOptLight.classList.remove('active');
  elements.bgOptDark.classList.add('active');
  activeContrastBg = elements.bgOptDark.getAttribute('data-bg');
  updateContrastUI(hexToRgb(activeColor));
});

elements.bgOptLight.addEventListener('click', () => {
  elements.bgOptDark.classList.remove('active');
  elements.bgOptLight.classList.add('active');
  activeContrastBg = elements.bgOptLight.getAttribute('data-bg');
  updateContrastUI(hexToRgb(activeColor));
});

// Custom background selection
elements.contrastCustomBg.addEventListener('input', (e) => {
  elements.bgOptDark.classList.remove('active');
  elements.bgOptLight.classList.remove('active');
  
  activeContrastBg = e.target.value;
  elements.customBgIndicator.style.backgroundColor = activeContrastBg;
  
  // visual indicator toggle border contrast
  const rgb = hexToRgb(activeContrastBg);
  elements.customBgIndicator.style.borderColor = isLightColor(rgb.r, rgb.g, rgb.b) ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
  
  updateContrastUI(hexToRgb(activeColor));
});

// Clear history
elements.clearHistoryBtn.addEventListener('click', async () => {
  historyColors = [];
  await storage.set('history', historyColors);
  renderHistory();
  showToast('History cleared');
});

// Save last active color before window closes (Chrome extension life-cycle event)
window.addEventListener('beforeunload', () => {
  storage.set('activeColor', activeColor);
});

// Start application
document.addEventListener('DOMContentLoaded', initApp);

// Listen for storage changes in real-time (to instantly sync picked colors from websites)
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.activeColor) {
        updateActiveColor(changes.activeColor.newValue, false);
      }
      if (changes.history) {
        historyColors = changes.history.newValue || [];
        renderHistory();
      }
    }
  });
}
