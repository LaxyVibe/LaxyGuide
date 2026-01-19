// Shared utilities for guide generator workflow

export const CONFIG = {
  API_ENDPOINTS: {
    PDF_PROCESS: window.location.hostname === 'localhost' 
      ? 'http://127.0.0.1:5001/laxy-guide-dev/us-central1/processPdfVertex'
      : 'https://processpdfvertex-kwy6rt2iqq-uc.a.run.app',
    TRANSLATE: window.location.hostname === 'localhost'
      ? 'http://127.0.0.1:5001/laxy-guide-dev/us-central1/translateContent'
      : 'https://translatecontent-kwy6rt2iqq-uc.a.run.app',
    AI_COPILOT: window.location.hostname === 'localhost'
      ? 'http://127.0.0.1:5001/laxy-guide-dev/us-central1/aiCopilot'
      : 'https://us-central1-laxy-guide-dev.cloudfunctions.net/aiCopilot'
  },
  LANGUAGES: ['en-US', 'ja-JP', 'ko-KR', 'zh-TW', 'zh-CN', 'fr-FR'],
  LANGUAGE_NAMES: {
    'en-US': 'English',
    'ja-JP': '日本語',
    'ko-KR': '한국어',
    'zh-TW': '繁體中文',
    'zh-CN': '简体中文',
    'fr-FR': 'Français'
  },
  GITHUB: {
    REPO_OWNER: 'LaxyVibe',
    REPO_NAME: 'LaxyGuide',
    TARGET_BRANCH: 'develop'
  }
};

// Session storage keys
export const STORAGE_KEYS = {
  GUIDE_DATA: 'laxy_guide_generator_data',
  CURRENT_STEP: 'laxy_guide_generator_step',
  CUSTOM_PROMPTS: 'laxy_ai_custom_prompts'
};

// Save data to session storage
export function saveToSession(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving to session:', error);
    return false;
  }
}

// Load data from session storage
export function loadFromSession(key) {
  try {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading from session:', error);
    return null;
  }
}

// Clear session data
export function clearSession() {
  Object.values(STORAGE_KEYS).forEach(key => {
    sessionStorage.removeItem(key);
  });
}

// Convert file to base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Format POI number
export function formatPoiNumber(num) {
  return String(num).padStart(3, '0');
}

// Validate guide code format
export function validateGuideCode(code) {
  const pattern = /^[A-Z]{3}-[A-Z]+-[A-Z]{3}-\d{3}$/;
  return pattern.test(code);
}

// Show toast notification
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  };
  
  toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Generate guide frontmatter
// Generate Guide frontmatter
export function generateGuideFrontmatter(data) {
  const frontmatter = {};
  CONFIG.LANGUAGES.forEach(lang => {
    // Maintain specific field order to match reference
    const langData = {};
    langData.title = data.titles[lang] || '';
    langData.code = data.code;
    langData.guideUnderlayImage = data.guideUnderlayImage || '';
    frontmatter[lang] = langData;
  });

  return `---\n${Object.entries(frontmatter)
    .map(([lang, langData]) => {
      const entries = Object.entries(langData)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join('\n');
      return `${lang}:\n${entries}`;
    })
    .join('\n')}\n---\n`;
}

// Generate POI frontmatter
export function generatePOIFrontmatter(guideCode, poi) {
  const frontmatter = {};
  CONFIG.LANGUAGES.forEach(lang => {
    // Maintain specific field order
    const langData = {};
    langData.displayAudio = poi.displayAudio !== false;
    langData.guide = guideCode;
    langData.number = poi.number;
    langData.title = poi.title[lang] || `POI ${poi.number}`;
    langData.hero = poi.hero || '';
    langData.script = poi.script?.[lang] 
      ? `>-\n    ${poi.script[lang].replace(/\n/g, '\n    ')}` 
      : '';
    langData.content = poi.content[lang] 
      ? `>-\n    ${poi.content[lang].replace(/\n/g, '\n    ')}` 
      : '';
    langData.ttml = poi.ttml || '';
    
    frontmatter[lang] = langData;
  });

  return `---\n${Object.entries(frontmatter)
    .map(([lang, data]) => {
      const entries = Object.entries(data)
        .map(([key, value]) => {
          if (typeof value === 'boolean') {
            return `  ${key}: ${value}`;
          }
          if (key === 'content' || key === 'script') {
            return `  ${key}: ${value}`;
          }
          return `  ${key}: ${value}`;
        })
        .join('\n');
      return `${lang}:\n${entries}`;
    })
    .join('\n')}\n---\n`;
}

// GitHub authentication
export async function getGithubToken() {
  const decapUser = localStorage.getItem('decap-cms-user') || localStorage.getItem('netlify-cms-user');
  if (decapUser) {
    const userData = JSON.parse(decapUser);
    if (userData.token) {
      return userData.token;
    }
  }
  return null;
}

export async function promptForGithubToken() {
  const token = prompt(
    'GitHub authentication required.\n\nPlease enter a GitHub Personal Access Token with repo permissions:\n(Create at: https://github.com/settings/tokens)'
  );
  return token;
}

// Load saved custom prompts from localStorage
export function loadCustomPrompts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPTS);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error loading custom prompts:', error);
    return [];
  }
}

// Save custom prompts to localStorage
export function saveCustomPrompts(prompts) {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPTS, JSON.stringify(prompts));
    return true;
  } catch (error) {
    console.error('Error saving custom prompts:', error);
    return false;
  }
}

// Add a new custom prompt
export function addCustomPrompt(label, prompt) {
  const prompts = loadCustomPrompts();
  prompts.push({ label, prompt, custom: true });
  saveCustomPrompts(prompts);
  return prompts;
}

// Delete a custom prompt
export function deleteCustomPrompt(index) {
  const prompts = loadCustomPrompts();
  prompts.splice(index, 1);
  saveCustomPrompts(prompts);
  return prompts;
}

// AI Copilot Presets
export const AI_COPILOT_PRESETS = {
  title: [
    { label: '✨ Make More Engaging', prompt: 'Rewrite this title to be more engaging and attractive to tourists while keeping the core meaning. Keep it concise (under 60 characters).' },
    { label: '📝 Simplify', prompt: 'Simplify this title to be clearer and easier to understand for international tourists.' },
    { label: '🎯 Add Keywords', prompt: 'Enhance this title by adding relevant keywords that tourists might search for, while keeping it natural.' },
  ],
  content: [
    { label: '✨ Enhance', prompt: 'Enhance this content to be more engaging and informative for tourists. Add interesting details and improve the flow while maintaining accuracy.' },
    { label: '📝 Simplify', prompt: 'Simplify this content to make it easier to understand for international tourists. Use clear, straightforward language.' },
    { label: '📏 Make Shorter', prompt: 'Condense this content to about 60% of its current length while keeping the most important and interesting information.' },
    { label: '📏 Make Longer', prompt: 'Expand this content with more interesting details, historical context, and cultural significance. Aim for about 150% of the current length.' },
    { label: '🎨 More Descriptive', prompt: 'Rewrite this content to be more vivid and descriptive, helping tourists visualize and appreciate the location better.' },
  ],
  script: [
    { label: '🎙️ Conversational Tone', prompt: 'Rewrite this narration script in a warm, conversational tone suitable for audio guides. Make it sound natural when spoken aloud.' },
    { label: '⏱️ Make Shorter (30s)', prompt: 'Condense this narration to fit within 30 seconds of speaking time (~75 words). Keep the most essential information.' },
    { label: '⏱️ Make Longer (60s)', prompt: 'Expand this narration to fill about 60 seconds of speaking time (~150 words). Add engaging details and context.' },
    { label: '👥 Tourist-Friendly', prompt: 'Rewrite this narration to be more engaging for tourists, using simple language and highlighting interesting facts.' },
  ]
};

// Show AI Copilot Modal
export function showAICopilotModal(fieldType, currentText, language, onApply) {
  const presets = AI_COPILOT_PRESETS[fieldType] || AI_COPILOT_PRESETS.content;
  const customPrompts = loadCustomPrompts();
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  modal.innerHTML = `
    <style>
      .gradient-bg {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      .split-view {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        height: 100%;
      }
      .before-after-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        height: 100%;
      }
      .custom-dropdown {
        position: relative;
      }
      .dropdown-toggle {
        width: 100%;
        text-align: left;
      }
      .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 0.5rem;
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        max-height: 400px;
        overflow-y: auto;
        z-index: 100;
      }
      .dropdown-item {
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid #f3f4f6;
      }
      .dropdown-item:hover {
        background: #f9fafb;
      }
      .dropdown-item.selected {
        background: #ede9fe;
        border-left: 3px solid #9333ea;
      }
      .dropdown-group-label {
        padding: 0.5rem 1rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }
      @media (max-width: 768px) {
        .split-view {
          grid-template-columns: 1fr;
          overflow-y: auto;
        }
        .before-after-container {
          grid-template-columns: 1fr;
        }
      }
    </style>

    <div class="bg-white rounded-lg shadow-2xl w-[95vw] h-[95vh] overflow-hidden flex flex-col" onclick="event.stopPropagation()">
      <!-- Header with AI Action Selector -->
      <div class="gradient-bg text-white px-6 py-4 flex-shrink-0">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-2xl font-bold">🤖 AI Copilot</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-white/90 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        
        <div class="flex gap-3 items-center">
          <label class="text-white/90 font-medium whitespace-nowrap">AI Action:</label>
          <div class="custom-dropdown flex-1">
            <button 
              id="dropdownToggle"
              class="dropdown-toggle px-4 py-2 bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-lg text-white focus:border-white focus:outline-none hover:bg-white/20 transition flex items-center justify-between"
            >
              <span id="selectedActionText">Select an action...</span>
              <svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="dropdownMenu" class="dropdown-menu hidden">
              <div class="dropdown-group-label">📋 Preset Actions</div>
              ${presets.map((preset, index) => `
                <div class="dropdown-item flex items-start justify-between group" data-type="preset" data-index="${index}">
                  <div class="flex-1 pr-2 cursor-pointer">
                    <div class="font-semibold text-gray-800">${preset.label}</div>
                    <div class="text-xs text-gray-500 mt-1 line-clamp-2">${preset.prompt}</div>
                  </div>
                  <button 
                    class="view-prompt-btn flex-shrink-0 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition text-sm"
                    data-prompt-label="${preset.label}"
                    data-prompt-text="${preset.prompt.replace(/"/g, '&quot;')}"
                    onclick="event.stopPropagation()"
                    title="View full prompt"
                  >
                    👁️
                  </button>
                </div>
              `).join('')}
              ${customPrompts.length > 0 ? `
                <div class="dropdown-group-label">📌 Your Saved Prompts</div>
                ${customPrompts.map((prompt, index) => `
                  <div class="dropdown-item flex items-start justify-between group" data-type="custom" data-index="${index}">
                    <div class="flex-1 pr-2 cursor-pointer">
                      <div class="font-semibold text-gray-800">${prompt.label}</div>
                      <div class="text-xs text-gray-600 mt-1 line-clamp-2">${prompt.prompt}</div>
                    </div>
                    <div class="flex gap-1 flex-shrink-0">
                      <button 
                        class="view-prompt-btn px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition text-sm"
                        data-prompt-label="${prompt.label}"
                        data-prompt-text="${prompt.prompt.replace(/"/g, '&quot;')}"
                        onclick="event.stopPropagation()"
                        title="View full prompt"
                      >
                        👁️
                      </button>
                      <button 
                        class="delete-custom-btn opacity-0 group-hover:opacity-100 px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition text-sm"
                        data-delete-index="${index}"
                        onclick="event.stopPropagation()"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                `).join('')}
              ` : ''}
              <div class="dropdown-group-label">✨ Custom</div>
              <div class="dropdown-item" data-type="new-custom">
                <div class="font-semibold text-purple-600">+ Create Custom Prompt</div>
                <div class="text-xs text-gray-500 mt-1">Write your own AI instruction</div>
              </div>
            </div>
          </div>
          <button 
            id="runActionBtn"
            disabled
            class="px-6 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            ▶️ Run
          </button>
          <button 
            id="applyBtn"
            disabled
            class="hidden px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            ✓ Apply
          </button>
        </div>
      </div>

      <!-- Split Content Area -->
      <div class="flex-1 overflow-hidden p-6">
        <div class="before-after-container h-full">
          <!-- Left Panel: Before (Original Text) -->
          <div class="flex flex-col">
            <label class="block text-sm font-semibold text-gray-700 mb-2">📄 Before (Original):</label>
            <textarea 
              id="beforeText"
              readonly
              class="flex-1 w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg text-sm resize-none font-mono"
            >${currentText || ''}</textarea>
          </div>

          <!-- Right Panel: After (AI Result) -->
          <div class="flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 p-4">
            <div id="processingStatus" class="hidden flex-1 flex items-center justify-center">
              <div class="text-center">
                <svg class="animate-spin h-12 w-12 text-purple-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-gray-700 text-lg font-medium">AI is processing your request...</p>
                <p class="text-gray-500 text-sm mt-2">This may take a few moments</p>
              </div>
            </div>

            <div id="resultSection" class="hidden flex flex-col h-full">
              <label class="block text-sm font-semibold text-gray-700 mb-2">✨ After (AI Result):</label>
              <textarea 
                id="resultText"
                class="flex-1 w-full px-4 py-3 border-2 border-green-300 bg-white rounded-lg focus:border-green-500 focus:outline-none text-sm font-mono resize-none"
              ></textarea>
            </div>

            <div id="emptyState" class="flex-1 flex items-center justify-center text-center">
              <div>
                <div class="text-6xl mb-4">🤖</div>
                <p class="text-gray-600 text-lg font-medium">Select an AI action</p>
                <p class="text-gray-400 text-sm mt-2">Choose a preset or create a custom prompt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedPrompt = null;
  let selectedPresetIndex = null;
  let selectedType = null;
  let selectedIndex = null;

  // Custom dropdown elements
  const dropdownToggle = modal.querySelector('#dropdownToggle');
  const dropdownMenu = modal.querySelector('#dropdownMenu');
  const selectedActionText = modal.querySelector('#selectedActionText');
  const runActionBtn = modal.querySelector('#runActionBtn');
  const applyBtn = modal.querySelector('#applyBtn');

  // Toggle dropdown
  dropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!modal.contains(e.target)) return;
    if (!dropdownToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.add('hidden');
    }
  });

  // Handle dropdown item selection
  modal.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const type = item.dataset.type;
      const index = item.dataset.index;

      // Remove previous selection
      modal.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');

      selectedType = type;
      selectedIndex = index;

      if (type === 'preset') {
        selectedPresetIndex = parseInt(index);
        selectedPrompt = presets[selectedPresetIndex].prompt;
        selectedActionText.textContent = presets[selectedPresetIndex].label;
        runActionBtn.disabled = false;
      } else if (type === 'custom') {
        const customIndex = parseInt(index);
        selectedPrompt = customPrompts[customIndex].prompt;
        selectedActionText.textContent = customPrompts[customIndex].label;
        runActionBtn.disabled = false;
        selectedPresetIndex = null;
      } else if (type === 'new-custom') {
        // Show custom prompt creation dialog
        showCustomPromptDialog(modal, fieldType, currentText, language, onApply);
        return; // Don't close dropdown or update selection
      }

      dropdownMenu.classList.add('hidden');
    });
  });

  // Delete custom prompt buttons
  modal.querySelectorAll('.delete-custom-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.deleteIndex);
      if (confirm(`Delete "${customPrompts[index].label}"?`)) {
        deleteCustomPrompt(index);
        modal.remove();
        showAICopilotModal(fieldType, currentText, language, onApply);
        showToast('Custom prompt deleted', 'success');
      }
    });
  });

  // View prompt buttons
  modal.querySelectorAll('.view-prompt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const label = btn.dataset.promptLabel;
      const promptText = btn.dataset.promptText.replace(/&quot;/g, '"');
      showPromptViewModal(label, promptText);
    });
  });

  // Run Action button
  runActionBtn.addEventListener('click', () => {
    if (selectedPrompt) {
      processAIRequest(selectedPrompt, currentText, language, modal, onApply);
    } else {
      showToast('Please select an AI action', 'warning');
    }
  });

  // Apply button in header
  applyBtn.addEventListener('click', () => {
    const resultText = modal.querySelector('#resultText').value;
    onApply(resultText);
    modal.remove();
    showToast('AI changes applied!', 'success');
  });
}

async function processAIRequest(prompt, currentText, language, modal, onApply) {
  const processingStatus = modal.querySelector('#processingStatus');
  const resultSection = modal.querySelector('#resultSection');
  const resultText = modal.querySelector('#resultText');
  const emptyState = modal.querySelector('#emptyState');
  const applyBtn = modal.querySelector('#applyBtn');

  // Hide empty state and show processing
  if (emptyState) emptyState.classList.add('hidden');
  processingStatus.classList.remove('hidden');
  resultSection.classList.add('hidden');
  if (applyBtn) applyBtn.disabled = true;

  try {
    const response = await fetch(CONFIG.API_ENDPOINTS.AI_COPILOT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        text: currentText,
        language: language
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'AI processing failed');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to process text');
    }

    // Show result
    resultText.value = result.data.processedText;
    processingStatus.classList.add('hidden');
    resultSection.classList.remove('hidden');
    
    // Enable apply button
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.classList.remove('hidden');
    }

  } catch (error) {
    console.error('AI Copilot error:', error);
    processingStatus.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    showToast(error.message, 'error');
  }
}

// Show prompt view modal
function showPromptViewModal(label, promptText) {
  const viewModal = document.createElement('div');
  viewModal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4';
  viewModal.onclick = (e) => {
    if (e.target === viewModal) viewModal.remove();
  };

  viewModal.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onclick="event.stopPropagation()">
      <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <h3 class="text-xl font-bold">👁️ View Prompt</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-white/90 hover:text-white text-3xl leading-none">&times;</button>
      </div>
      
      <div class="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-120px)]">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">Label:</label>
          <div class="px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg font-semibold text-gray-800">
            ${label}
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">Prompt Instructions:</label>
          <div class="px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg text-sm whitespace-pre-wrap">
            ${promptText}
          </div>
        </div>
      </div>
      
      <div class="px-6 py-4 bg-gray-50 border-t-2 border-gray-200 flex justify-end">
        <button 
          onclick="this.closest('.fixed').remove()"
          class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
        >
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(viewModal);
}

// Show custom prompt creation dialog
function showCustomPromptDialog(parentModal, fieldType, currentText, language, onApply) {
  const customModal = document.createElement('div');
  customModal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4';
  customModal.onclick = (e) => {
    if (e.target === customModal) customModal.remove();
  };

  customModal.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onclick="event.stopPropagation()">
      <div class="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
        <h3 class="text-xl font-bold">✨ Create Custom Prompt</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-white/90 hover:text-white text-3xl leading-none">&times;</button>
      </div>
      
      <div class="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-180px)]">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">Label:</label>
          <input 
            id="newCustomPromptLabel"
            type="text"
            placeholder="e.g., 'Make Academic', 'Simplify Language'..."
            class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
          >
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">Prompt Instructions:</label>
          <textarea 
            id="newCustomPromptInput"
            rows="6"
            placeholder="Describe what you want the AI to do with the text...&#10;&#10;Example:&#10;Rewrite the text in a more academic tone, using formal language and avoiding contractions."
            class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm resize-none"
          ></textarea>
          <p class="text-xs text-gray-500 mt-2">💡 Tip: Be specific about what changes you want. The AI will apply this instruction to your text.</p>
        </div>
      </div>
      
      <div class="px-6 py-4 bg-gray-50 border-t-2 border-gray-200 flex justify-end gap-3">
        <button 
          onclick="this.closest('.fixed').remove()"
          class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium"
        >
          Cancel
        </button>
        <button 
          id="runCustomPromptBtn"
          class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
        >
          ▶️ Run Now
        </button>
        <button 
          id="saveNewCustomBtn"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          💾 Save & Run
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(customModal);

  const newLabelInput = customModal.querySelector('#newCustomPromptLabel');
  const newPromptInput = customModal.querySelector('#newCustomPromptInput');
  const runBtn = customModal.querySelector('#runCustomPromptBtn');
  const saveBtn = customModal.querySelector('#saveNewCustomBtn');

  // Run custom prompt without saving
  runBtn.addEventListener('click', () => {
    const prompt = newPromptInput.value.trim();
    
    if (!prompt) {
      showToast('Please enter prompt instructions', 'warning');
      return;
    }
    
    customModal.remove();
    processAIRequest(prompt, currentText, language, parentModal, onApply);
  });

  // Save and run custom prompt
  saveBtn.addEventListener('click', () => {
    const label = newLabelInput.value.trim();
    const prompt = newPromptInput.value.trim();
    
    if (!label || !prompt) {
      showToast('Please enter both label and prompt instructions', 'warning');
      return;
    }
    
    addCustomPrompt(label, prompt);
    showToast('Custom prompt saved!', 'success');
    
    customModal.remove();
    processAIRequest(prompt, currentText, language, parentModal, onApply);
  });
}
