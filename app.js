// Sensus Couples Language Learning App State
const state = {
  partnerA: '',
  partnerB: '',
  languagePair: 'german-swedish', // german-swedish, swedish-german, italian-english
  level: 'B2',
  apiKey: '',
  currentMode: 'story', // story, vocabulary, listening, reading, conversation
  history: [],
  activeExercises: {
    story: null,
    vocabulary: null,
    listening: null,
    reading: null,
    conversation: null
  }
};

// Target Language Code Helper (for Speech Synthesis)
function getTargetLanguageCode() {
  if (state.languagePair === 'german-swedish') return 'sv-SE';
  if (state.languagePair === 'swedish-german') return 'de-DE';
  if (state.languagePair === 'italian-english') return 'en-US';
  return 'sv-SE';
}

// ----------------------------------------------------
// 1. INITIATION & SETTINGS MANAGERS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSavedSettings();
  setupEventListeners();
  loadPracticeHistory();
  
  // Initialize voices (triggers async voice load in Chrome/Edge)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }
});

function initTheme() {
  const savedTheme = localStorage.getItem('sensus-theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  const body = document.body;
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  
  if (theme === 'dark') {
    body.classList.remove('theme-light');
    body.classList.add('theme-dark');
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    body.classList.remove('theme-dark');
    body.classList.add('theme-light');
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
  localStorage.setItem('sensus-theme', theme);
}

function toggleTheme() {
  const currentTheme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

async function loadSavedSettings() {
  try {
    const response = await fetch('api/settings');
    if (response.ok) {
      const data = await response.json();
      state.partnerA = data.partnerA || '';
      state.partnerB = data.partnerB || '';
      state.languagePair = data.languagePair || 'german-swedish';
      state.level = data.level || 'B2';
      state.apiKey = data.apiKey || '';
      state.currentMode = data.currentMode || 'story';
      if (data.activeExercises) {
        state.activeExercises = { ...state.activeExercises, ...data.activeExercises };
      }
    }
  } catch (e) {
    console.error("Failed to load settings from server, falling back to local storage", e);
    state.partnerA = localStorage.getItem('sensus-partner-a') || '';
    state.partnerB = localStorage.getItem('sensus-partner-b') || '';
    state.languagePair = localStorage.getItem('sensus-language-pair') || 'german-swedish';
    state.level = localStorage.getItem('sensus-level') || 'B2';
    state.apiKey = localStorage.getItem('sensus-api-key') || '';
    state.currentMode = localStorage.getItem('sensus-current-mode') || 'story';
  }

  if (state.partnerA && state.partnerB) {
    showDashboard();
  } else {
    showSetup();
  }
}

function showSetup() {
  document.getElementById('screen-setup').style.display = 'block';
  document.getElementById('screen-dashboard').style.display = 'none';
  document.getElementById('btn-show-settings').style.display = 'none';
  
  // Fill values in setup form
  document.getElementById('input-partner-a').value = state.partnerA;
  document.getElementById('input-partner-b').value = state.partnerB;
  document.getElementById('select-languages').value = state.languagePair;
  document.getElementById('select-level').value = state.level;
  document.getElementById('input-api-key').value = state.apiKey;
}

function showDashboard() {
  document.getElementById('screen-setup').style.display = 'none';
  document.getElementById('screen-dashboard').style.display = 'block';
  document.getElementById('btn-show-settings').style.display = 'block';
  
  // Update Labels
  document.getElementById('label-couple-names').textContent = `${state.partnerA} & ${state.partnerB}`;
  
  let pathText = "German ➔ Swedish";
  if (state.languagePair === 'swedish-german') pathText = "Swedish ➔ German";
  else if (state.languagePair === 'italian-english') pathText = "Italian ➔ English";
  
  document.getElementById('label-selected-path').textContent = pathText;
  
  const levelLabel = document.getElementById('label-selected-level');
  levelLabel.textContent = state.level;
  
  // Adjust level class color
  levelLabel.className = 'tag';
  if (['A1', 'A2'].includes(state.level)) levelLabel.classList.add('tag-rose');
  else if (['B1', 'B2'].includes(state.level)) levelLabel.classList.add('tag-sage');
  else levelLabel.classList.add('tag-slate');

  // Sync tab buttons active state
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(t => {
    if (t.dataset.mode === state.currentMode) {
      t.classList.add('active');
      t.setAttribute('aria-selected', 'true');
    } else {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    }
  });

  if (state.activeExercises[state.currentMode]) {
    renderActiveExercise(state.currentMode);
  } else {
    renderWorkspaceEmptyState();
  }
}

function saveSettings(partnerA, partnerB, langPair, level, apiKey) {
  // Discard cached active exercises if language path or difficulty changes
  if (state.languagePair !== langPair || state.level !== level) {
    state.activeExercises = {
      story: null,
      vocabulary: null,
      listening: null,
      reading: null,
      conversation: null
    };
  }

  state.partnerA = partnerA.trim();
  state.partnerB = partnerB.trim();
  state.languagePair = langPair;
  state.level = level;
  state.apiKey = apiKey.trim();

  // Save new settings to the server
  saveStateToServer();

  showDashboard();
}

// ----------------------------------------------------
// 2. BACKEND API INTERACTIONS
// ----------------------------------------------------
async function apiRequest(endpoint, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.apiKey) {
    headers['X-Gemini-Key'] = state.apiKey;
  }
  
  // Resolve base path dynamically to support Cloudflare proxy /languages/ routing
  const relativeEndpoint = endpoint.replace(/^\//, ''); // strip leading slash
  
  const response = await fetch(relativeEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr = { error: 'Unknown server error' };
    try { parsedErr = JSON.parse(errText); } catch(e) {}
    throw new Error(parsedErr.error || errText);
  }
  
  return await response.json();
}

async function loadPracticeHistory() {
  try {
    const response = await fetch('api/history');
    if (response.ok) {
      state.history = await response.json();
      renderHistoryList();
    }
  } catch(e) {
    console.error("Failed to load history logs", e);
  }
}

async function saveToHistory(record) {
  try {
    const res = await apiRequest('api/history', record);
    if (res.success) {
      state.history.unshift(res.record);
      renderHistoryList();
    }
  } catch (e) {
    console.error("Failed to write session log to server", e);
  }
}

function compileHistoricalContext() {
  const context = {
    pastTitles: [],
    pastWords: [],
    pastTopics: [],
    difficultWords: []
  };
  
  if (!state.history || !Array.isArray(state.history)) return context;

  // Look at history (limit to most recent 20 entries)
  state.history.slice(0, 20).forEach(item => {
    if (item.title) context.pastTitles.push(item.title);
    
    if (item.exerciseData) {
      const data = item.exerciseData;
      if (item.mode === 'Vocabulary Match' && data.questions) {
        data.questions.forEach(q => {
          if (q.word) context.pastWords.push(q.word);
        });
      }
      if (item.mode === 'Active Conversation' && data.topic) {
        context.pastTopics.push(data.topic);
      }
    }

    // Collect difficult words flagged in past sessions
    if (item.userProgress && Array.isArray(item.userProgress.difficultWords)) {
      item.userProgress.difficultWords.forEach(word => {
        if (!context.difficultWords.includes(word)) {
          context.difficultWords.push(word);
        }
      });
    }
  });
  
  return context;
}

async function saveStateToServer() {
  try {
    // Keep localstorage as a local fallback
    localStorage.setItem('sensus-active-exercises', JSON.stringify(state.activeExercises));
    localStorage.setItem('sensus-current-mode', state.currentMode);
    localStorage.setItem('sensus-partner-a', state.partnerA);
    localStorage.setItem('sensus-partner-b', state.partnerB);
    localStorage.setItem('sensus-language-pair', state.languagePair);
    localStorage.setItem('sensus-level', state.level);
    localStorage.setItem('sensus-api-key', state.apiKey);

    // Sync to server
    await apiRequest('api/settings', {
      partnerA: state.partnerA,
      partnerB: state.partnerB,
      languagePair: state.languagePair,
      level: state.level,
      apiKey: state.apiKey,
      currentMode: state.currentMode,
      activeExercises: state.activeExercises
    });
  } catch (e) {
    console.error("Failed to sync state to server", e);
  }
}

// ----------------------------------------------------
// 3. EVENT LISTENERS
// ----------------------------------------------------
function setupEventListeners() {
  // Theme toggler
  document.getElementById('btn-toggle-theme').addEventListener('click', toggleTheme);

  // Setup Form
  document.getElementById('form-setup').addEventListener('submit', (e) => {
    e.preventDefault();
    const partnerA = document.getElementById('input-partner-a').value;
    const partnerB = document.getElementById('input-partner-b').value;
    const langPair = document.getElementById('select-languages').value;
    const level = document.getElementById('select-level').value;
    const apiKey = document.getElementById('input-api-key').value;
    saveSettings(partnerA, partnerB, langPair, level, apiKey);
  });

  // Settings modals
  const settingsModal = document.getElementById('modal-settings');
  document.getElementById('btn-show-settings').addEventListener('click', () => {
    document.getElementById('modal-partner-a').value = state.partnerA;
    document.getElementById('modal-partner-b').value = state.partnerB;
    document.getElementById('modal-languages').value = state.languagePair;
    document.getElementById('modal-level').value = state.level;
    document.getElementById('modal-api-key').value = state.apiKey;
    settingsModal.style.display = 'flex';
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  document.getElementById('btn-cancel-settings').addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  document.getElementById('btn-edit-setup').addEventListener('click', () => {
    showSetup();
  });

  document.getElementById('form-settings-modal').addEventListener('submit', (e) => {
    e.preventDefault();
    const partnerA = document.getElementById('modal-partner-a').value;
    const partnerB = document.getElementById('modal-partner-b').value;
    const langPair = document.getElementById('modal-languages').value;
    const level = document.getElementById('modal-level').value;
    const apiKey = document.getElementById('modal-api-key').value;
    saveSettings(partnerA, partnerB, langPair, level, apiKey);
    settingsModal.style.display = 'none';
  });

  // History detail modal close listener
  const historyModal = document.getElementById('modal-history-detail');
  const closeHistoryBtn = document.getElementById('btn-close-history-modal');
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', () => {
      historyModal.style.display = 'none';
    });
  }

  // Mode Selection Tabs
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.currentMode = tab.dataset.mode;
      saveStateToServer();
      if (state.activeExercises[state.currentMode]) {
        renderActiveExercise(state.currentMode);
      } else {
        renderWorkspaceEmptyState();
      }
    });
  });

  // Global window click to dismiss modal
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
    if (e.target === historyModal) {
      historyModal.style.display = 'none';
    }
  });

  // Auto-save active exercises on user interactions within workspace
  document.getElementById('study-workspace').addEventListener('click', () => {
    if (state.activeExercises[state.currentMode]) {
      saveStateToServer();
    }
  });
}

// ----------------------------------------------------
// 4. RENDER PROCEDURES
// ----------------------------------------------------
function renderWorkspaceEmptyState() {
  const container = document.getElementById('study-workspace');
  let modeName = "Pimsleur Stories";
  let modeDesc = "Read and listen to organic, alternating dialogue scenarios together. Take turns speaking and test comprehension.";
  
  if (state.currentMode === 'vocabulary') {
    modeName = "Vocabulary Cards";
    modeDesc = "Interactive context-aware translation challenges, exploring etymology and nuances.";
  } else if (state.currentMode === 'listening') {
    modeName = "Listening Comprehension";
    modeDesc = "Listen to clear sentences read aloud by native voices, and solve comprehension quizzes.";
  } else if (state.currentMode === 'reading') {
    modeName = "Philosophical Reading Passage";
    modeDesc = "Immerse in short, literary texts reflecting on relationships, mindfulness, or time, with vocabulary glossaries.";
  } else if (state.currentMode === 'conversation') {
    modeName = "Conversation Prompts";
    modeDesc = "Couples prompt practice. Speak or write responses to each other, and get detailed critique and translations.";
  }

  container.innerHTML = `
    <div class="workspace-empty-state" style="width: 100%; max-width: 500px; margin: auto;">
      <h3 class="editorial-heading">${modeName}</h3>
      <p class="editorial-body" style="margin-bottom: 1.5rem;">${modeDesc}</p>
      
      <!-- Role Selection for Conversation Mode -->
      ${state.currentMode === 'conversation' ? `
      <div class="form-group role-selection-box" style="text-align: left; width: 100%; margin-bottom: 1.5rem;">
        <label>Who is the Learner today?</label>
        <div style="display: flex; gap: 2rem; margin-top: 0.4rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; text-transform: none; font-size: 1rem; color: var(--text-primary); cursor: pointer;">
            <input type="radio" name="learner-role-radio" value="partnerA" checked style="cursor: pointer;">
            <span>${state.partnerA || 'Partner A'}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem; text-transform: none; font-size: 1rem; color: var(--text-primary); cursor: pointer;">
            <input type="radio" name="learner-role-radio" value="partnerB" style="cursor: pointer;">
            <span>${state.partnerB || 'Partner B'}</span>
          </label>
        </div>
        <small class="form-help">The other partner will act as the Guide/Expert holding the phone.</small>
      </div>
      ` : ''}
      
      <!-- Theme Selection Dropdown -->
      <div class="form-group theme-selection-box" style="text-align: left; width: 100%; margin-bottom: 1.5rem;">
        <label for="select-exercise-theme">Exercise Theme</label>
        <select id="select-exercise-theme" style="width: 100%; margin-top: 0.4rem;">
          <option value="random" selected>🌱 Random / AI Choice</option>
          <option value="Sharing a family recipe">🍳 Sharing a family recipe</option>
          <option value="Planning a weekend getaway">🧳 Planning a weekend getaway</option>
          <option value="Discussing a book or movie">📚 Discussing a book or movie</option>
          <option value="A quiet walk in a misty forest">🌲 A quiet walk in a misty forest</option>
          <option value="Remembering a favorite holiday">🏖️ Remembering a favorite holiday</option>
          <option value="Dreaming about a future home">🏡 Dreaming about a future home</option>
          <option value="Exploring a local farmer's market">🍎 Exploring a local farmer's market</option>
          <option value="Stargazing on a clear night">🌌 Stargazing on a clear night</option>
          <option value="Coffee at a hidden sidewalk café">☕ Coffee at a hidden sidewalk café</option>
          <option value="A cozy rainy afternoon indoors">☔ A cozy rainy afternoon indoors</option>
          <option value="Sharing childhood memories">🧸 Sharing childhood memories</option>
          <option value="Reflecting on a museum exhibition">🖼️ Reflecting on a museum exhibition</option>
          <option value="Making plans for a garden">🌻 Making plans for a garden</option>
          <option value="Watching a sunset by the harbor">⛵ Watching a sunset by the harbor</option>
          <option value="Reflecting on time and memory">⏳ Reflecting on time and memory</option>
          <option value="Learning a new hobby together">🎨 Learning a new hobby together</option>
          <option value="Sharing gratitude for small details">🕊️ Sharing gratitude for small details</option>
          <option value="Navigating a new city together">🗺️ Navigating a new city together</option>
          <option value="Picking a gift for a mutual friend">🎁 Picking a gift for a mutual friend</option>
          <option value="Discussing a favorite season">🍂 Discussing a favorite season</option>
          <option value="custom">✍️ Custom Theme (Free Write...)</option>
        </select>
        <div id="custom-theme-wrapper" style="display: none; margin-top: 0.8rem;">
          <input type="text" id="input-custom-theme" placeholder="e.g. A train journey across Switzerland..." style="width: 100%;">
        </div>
      </div>
      
      <button id="btn-generate-content" class="btn-primary" style="width: 100%;">Generate ${modeName}</button>
    </div>
  `;

  const themeSelect = document.getElementById('select-exercise-theme');
  const customWrapper = document.getElementById('custom-theme-wrapper');
  if (themeSelect && customWrapper) {
    themeSelect.addEventListener('change', () => {
      customWrapper.style.display = themeSelect.value === 'custom' ? 'block' : 'none';
      if (themeSelect.value === 'custom') {
        document.getElementById('input-custom-theme').focus();
      }
    });
  }

  document.getElementById('btn-generate-content').addEventListener('click', generateCurrentExercise);
  
  // Also link the dashboard initial button if it shows up
  const initialBtn = document.getElementById('btn-generate-initial');
  if (initialBtn) {
    initialBtn.addEventListener('click', generateCurrentExercise);
  }
}

function renderSpinner(message = "Consulting Gemini...") {
  const container = document.getElementById('study-workspace');
  container.innerHTML = `
    <div class="spinner-container">
      <div class="spinner"></div>
      <div class="loading-text">${message}</div>
    </div>
  `;
}

function renderError(message) {
  const container = document.getElementById('study-workspace');
  container.innerHTML = `
    <div class="error-banner">
      <strong>Verification Error:</strong> ${message}
    </div>
    <div style="text-align: center; margin-top: 1rem;">
      <button onclick="renderWorkspaceEmptyState()" class="btn-secondary">Back to Settings</button>
    </div>
  `;
}

// ----------------------------------------------------
// 5. TTS / SPEECH SYNTHESIS ENGINE
// ----------------------------------------------------
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  
  window.speechSynthesis.cancel(); // stop current sound
  
  const targetCode = getTargetLanguageCode();
  const utterance = new SpeechSynthesisUtterance(text);
  
  const voices = window.speechSynthesis.getVoices();
  // Find a voice that exactly matches the language
  const voice = voices.find(v => v.lang.startsWith(targetCode.split('-')[0]));
  if (voice) {
    utterance.voice = voice;
  } else {
    utterance.lang = targetCode;
  }
  
  utterance.rate = 0.85; // Slow down slightly for educational comprehension
  utterance.pitch = 1.0;
  
  window.speechSynthesis.speak(utterance);
}

// ----------------------------------------------------
// 6. GENERATION CONTROLLER
// ----------------------------------------------------
async function generateCurrentExercise() {
  let selectedTheme = "random";
  const themeSelect = document.getElementById('select-exercise-theme');
  if (themeSelect) {
    if (themeSelect.value === 'custom') {
      const customInput = document.getElementById('input-custom-theme');
      selectedTheme = customInput ? customInput.value.trim() : "";
    } else {
      selectedTheme = themeSelect.value;
    }
  }

  // Determine Learner and Guide names
  let learnerName = state.partnerA || 'Partner A';
  let guideName = state.partnerB || 'Partner B';
  const learnerRadio = document.querySelector('input[name="learner-role-radio"]:checked');
  if (learnerRadio) {
    if (learnerRadio.value === 'partnerB') {
      learnerName = state.partnerB || 'Partner B';
      guideName = state.partnerA || 'Partner A';
    }
  }

  const histContext = compileHistoricalContext();
  const diffWords = histContext.difficultWords || [];

  renderSpinner(`Drafting your custom ${state.currentMode} exercise...`);
  try {
    const res = await apiRequest('api/generate', {
      mode: state.currentMode,
      level: state.level,
      languagePair: state.languagePair,
      partnerA: state.partnerA,
      partnerB: state.partnerB,
      theme: selectedTheme,
      historyContext: histContext,
      learnerName: learnerName,
      guideName: guideName,
      difficultWords: diffWords
    });

    if (res.success && res.data) {
      const mode = state.currentMode;
      // Initialize active exercise state
      if (mode === 'story') {
        state.activeExercises.story = {
          data: res.data,
          activeQuestionIndex: 0,
          correctCount: 0,
          showTranslations: false,
          answers: {} // qIndex -> oIndex
        };
      } else if (mode === 'vocabulary') {
        state.activeExercises.vocabulary = {
          data: res.data,
          answers: {} // qIndex -> { selectedOptionIndex: null, revealed: false, grade: null }
        };
      } else if (mode === 'listening') {
        state.activeExercises.listening = {
          data: res.data,
          activeIndex: 0,
          correctCount: 0,
          showTranscription: false,
          answers: {} // index -> oIndex
        };
      } else if (mode === 'reading') {
        state.activeExercises.reading = {
          data: res.data,
          activeIndex: 0,
          correctCount: 0,
          showTranslation: false,
          answers: {} // qIndex -> oIndex
        };
      } else if (mode === 'conversation') {
        state.activeExercises.conversation = {
          data: res.data,
          learnerName: learnerName,
          guideName: guideName,
          grades: {}, // stepIndex -> grade ('coherent' | 'effort' | 'revisions')
          difficultWords: [] // flagged words in this session
        };
      }
      
      saveStateToServer();
      renderActiveExercise(mode);
    } else {
      renderError("Could not retrieve exercise details from Gemini.");
    }
  } catch (err) {
    renderError(err.message);
  }
}

function renderActiveExercise(mode) {
  const activeEx = state.activeExercises[mode];
  if (!activeEx) {
    renderWorkspaceEmptyState();
    return;
  }
  
  if (mode === 'story') renderStoryExercise(activeEx);
  else if (mode === 'vocabulary') renderVocabularyExercise(activeEx);
  else if (mode === 'listening') renderListeningExercise(activeEx);
  else if (mode === 'reading') renderReadingExercise(activeEx);
  else if (mode === 'conversation') renderConversationExercise(activeEx);
}

function getDiscardButtonHTML() {
  return `<button id="btn-discard-exercise" class="btn-secondary btn-small" style="margin-left: 1rem; border-color: var(--terracotta); color: var(--terracotta);">New Exercise</button>`;
}

function setupDiscardButtonListener() {
  const btn = document.getElementById('btn-discard-exercise');
  if (btn) {
    btn.addEventListener('click', () => {
      if (confirm("Are you sure you want to discard this exercise and start a new one?")) {
        state.activeExercises[state.currentMode] = null;
        saveStateToServer();
        renderWorkspaceEmptyState();
      }
    });
  }
}

// ----------------------------------------------------
// 7. SPECIFIC EXERCISE RENDERERS
// ----------------------------------------------------

// Mode A: PIMSLEUR STORY RENDERER
function renderStoryExercise(activeEx) {
  const data = activeEx.data;
  const container = document.getElementById('study-workspace');
  let dialogueHTML = '';
  
  data.dialogue.forEach((line, index) => {
    const isPartnerA = index % 2 === 0;
    const speakerClass = isPartnerA ? 'bubble-partner-a' : 'bubble-partner-b';
    const speakerName = line.speaker || (isPartnerA ? state.partnerA : state.partnerB);
    const translationStyle = activeEx.showTranslations ? 'display: block;' : 'display: none;';
    
    dialogueHTML += `
      <div class="dialogue-bubble ${speakerClass}">
        <span class="speaker-label">${speakerName} (${isPartnerA ? 'Partner A' : 'Partner B'})</span>
        <div class="text-target">${line.text}</div>
        <div class="text-translation" style="${translationStyle}">${line.translation}</div>
        <button class="btn-tts" onclick="speak('${line.text.replace(/'/g, "\\'")}')" style="margin-top: 0.5rem; padding: 0.2rem 0.6rem; font-size: 0.75rem;">
          🔊 Play audio
        </button>
      </div>
    `;
  });

  let questionsHTML = '';
  data.comprehension.forEach((q, qIndex) => {
    let optionsHTML = '';
    const selectedOIndex = activeEx.answers[qIndex] !== undefined ? activeEx.answers[qIndex] : null;
    const answered = selectedOIndex !== null;
    const correctIdx = q.answerIndex;
    
    q.options.forEach((opt, oIndex) => {
      let optionClass = 'option-card';
      if (answered) {
        if (oIndex === correctIdx) optionClass += ' correct';
        else if (oIndex === selectedOIndex) optionClass += ' incorrect';
      }
      optionsHTML += `
        <button class="option-card ${optionClass}" data-qindex="${qIndex}" data-oindex="${oIndex}" ${answered ? 'disabled' : ''}>
          <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
          <div>${opt}</div>
        </button>
      `;
    });

    const isVisible = qIndex === activeEx.activeQuestionIndex ? 'block' : 'none';
    const feedbackVisible = answered ? 'block' : 'none';
    const feedbackTitle = answered ? (selectedOIndex === correctIdx ? 'Correct Reflection' : 'Incorrect Interpretation') : '';
    const feedbackClass = answered ? (selectedOIndex === correctIdx ? 'feedback-panel feedback-success' : 'feedback-panel feedback-error') : 'feedback-panel feedback-neutral';

    questionsHTML += `
      <div class="quiz-question-box" id="q-box-${qIndex}" style="margin-top: 2rem; display: ${isVisible};">
        <h4 style="font-family: Outfit; font-size: 1.1rem; margin-bottom: 0.5rem;">Question ${qIndex + 1} of 3</h4>
        <p style="font-family: Lora; font-size: 1.15rem; font-style: italic;">${q.question}</p>
        <div class="quiz-options-list">${optionsHTML}</div>
        <div class="${feedbackClass}" id="q-feedback-${qIndex}" style="display: ${feedbackVisible};">
          <div class="feedback-title" id="q-feedback-title-${qIndex}">${feedbackTitle}</div>
          <div class="feedback-text" id="q-feedback-text-${qIndex}"></div>
          <div class="explanation-text">${q.explanation}</div>
        </div>
      </div>
    `;
  });

  const translationBtnText = activeEx.showTranslations ? 'Hide Translations' : 'Show Translations';

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">${data.title}</h3>
        <div class="content-subtitle">Pimsleur Dialogue & Comprehension</div>
      </div>
      <div style="display: flex; align-items: center;">
        <span class="tag tag-slate">${state.level}</span>
        ${getDiscardButtonHTML()}
      </div>
    </div>
    
    <div class="exercise-container">
      <div class="hero-gradient-card dawn">
        <div class="hero-content">
          <h3>Scenario context</h3>
          <p>${data.scenario}</p>
        </div>
      </div>

      <div class="translation-toggle-bar">
        <button id="btn-toggle-translations" class="btn-secondary">${translationBtnText}</button>
      </div>

      <div class="dialogue-thread">
        ${dialogueHTML}
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 2rem; margin-top: 2rem;">
        <h3 style="font-family: Outfit; text-align: center; margin-bottom: 1rem;">Comprehension Check</h3>
        <p style="text-align: center; color: var(--text-muted); font-size: 0.95rem; margin-bottom: 2rem;">
          Sit together and discuss the correct answers.
        </p>
        ${questionsHTML}
        
        <div id="quiz-navigation" style="display: flex; justify-content: space-between; margin-top: 2rem;">
          <button id="btn-prev-q" class="btn-secondary" style="visibility: ${activeEx.activeQuestionIndex > 0 ? 'visible' : 'hidden'};">Previous Question</button>
          <button id="btn-next-q" class="btn-primary" style="display: none;">Next Question</button>
          <button id="btn-finish-story" class="btn-primary" style="display: none;">Log Session</button>
        </div>
      </div>
    </div>
  `;

  setupDiscardButtonListener();

  const nextBtn = document.getElementById('btn-next-q');
  const prevBtn = document.getElementById('btn-prev-q');
  const finishBtn = document.getElementById('btn-finish-story');

  const currentAnswered = activeEx.answers[activeEx.activeQuestionIndex] !== undefined;
  if (currentAnswered) {
    if (activeEx.activeQuestionIndex < data.comprehension.length - 1) {
      nextBtn.style.display = 'inline-flex';
    } else {
      finishBtn.style.display = 'inline-flex';
    }
  }

  // Toggle Translations
  const transBtn = document.getElementById('btn-toggle-translations');
  transBtn.addEventListener('click', () => {
    activeEx.showTranslations = !activeEx.showTranslations;
    const translations = document.querySelectorAll('.text-translation');
    translations.forEach(el => el.style.display = activeEx.showTranslations ? 'block' : 'none');
    transBtn.textContent = activeEx.showTranslations ? 'Hide Translations' : 'Show Translations';
  });

  // Handle option click
  const optionCards = container.querySelectorAll('.option-card');
  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      const qIndex = parseInt(card.dataset.qindex);
      const oIndex = parseInt(card.dataset.oindex);
      
      if (activeEx.answers[qIndex] !== undefined) return;
      
      activeEx.answers[qIndex] = oIndex;
      const correctIdx = data.comprehension[qIndex].answerIndex;
      
      const feedbackBox = document.getElementById(`q-feedback-${qIndex}`);
      const feedbackTitle = document.getElementById(`q-feedback-title-${qIndex}`);
      feedbackBox.style.display = 'block';

      const siblings = container.querySelectorAll(`.option-card[data-qindex="${qIndex}"]`);
      siblings.forEach((s, idx) => {
        s.disabled = true;
        if (idx === correctIdx) s.classList.add('correct');
        else if (idx === oIndex) s.classList.add('incorrect');
      });

      if (oIndex === correctIdx) {
        feedbackBox.className = "feedback-panel feedback-success";
        feedbackTitle.textContent = "Correct Reflection";
        activeEx.correctCount++;
      } else {
        feedbackBox.className = "feedback-panel feedback-error";
        feedbackTitle.textContent = "Incorrect Interpretation";
      }

      if (activeEx.activeQuestionIndex < data.comprehension.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    });
  });

  nextBtn.addEventListener('click', () => {
    document.getElementById(`q-box-${activeEx.activeQuestionIndex}`).style.display = 'none';
    activeEx.activeQuestionIndex++;
    document.getElementById(`q-box-${activeEx.activeQuestionIndex}`).style.display = 'block';
    
    prevBtn.style.visibility = 'visible';
    nextBtn.style.display = 'none';

    const answered = activeEx.answers[activeEx.activeQuestionIndex] !== undefined;
    if (answered) {
      if (activeEx.activeQuestionIndex < data.comprehension.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    }
  });

  prevBtn.addEventListener('click', () => {
    document.getElementById(`q-box-${activeEx.activeQuestionIndex}`).style.display = 'none';
    activeEx.activeQuestionIndex--;
    document.getElementById(`q-box-${activeEx.activeQuestionIndex}`).style.display = 'block';
    
    if (activeEx.activeQuestionIndex === 0) {
      prevBtn.style.visibility = 'hidden';
    }
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';

    const answered = activeEx.answers[activeEx.activeQuestionIndex] !== undefined;
    if (answered) {
      if (activeEx.activeQuestionIndex < data.comprehension.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    }
  });

  finishBtn.addEventListener('click', () => {
    const scoreStr = `${activeEx.correctCount}/${data.comprehension.length}`;
    const logRecord = {
      title: data.title,
      mode: 'Pimsleur Story',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`,
      exerciseData: data,
      userProgress: {
        answers: activeEx.answers,
        correctCount: activeEx.correctCount
      }
    };
    saveToHistory(logRecord);
    state.activeExercises.story = null;
    saveStateToServer();
    
    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Dialogue completed and logged</h3>
        <p style="margin-bottom: 2rem;">Congratulations on reading together. You answered ${activeEx.correctCount} out of ${data.comprehension.length} questions correctly.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// Mode B: VOCABULARY EXERCISE RENDERER (20 Cards, Scrollable list, Partner graded)
function renderVocabularyExercise(activeEx) {
  const data = activeEx.data;
  const container = document.getElementById('study-workspace');
  let cardsHTML = '';

  data.questions.forEach((q, qIndex) => {
    const qState = activeEx.answers[qIndex] || { selectedOptionIndex: null, revealed: false, grade: null };
    activeEx.answers[qIndex] = qState; // ensure set

    let optionsHTML = '';
    const answered = qState.grade !== null;

    q.options.forEach((opt, oIndex) => {
      let optionClass = 'option-card vocab-deck-option';
      if (qState.selectedOptionIndex === oIndex) {
        optionClass += ' selected';
      }
      optionsHTML += `
        <button class="option-card ${optionClass}" data-qindex="${qIndex}" data-oindex="${oIndex}" ${answered ? 'disabled' : ''}>
          <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
          <div>${opt}</div>
        </button>
      `;
    });

    const isRevealed = qState.revealed || answered;
    const answerBlockStyle = isRevealed ? 'display: block;' : 'display: none;';
    const revealBtnText = qState.revealed ? 'Hide Answer Details' : 'Reveal Answer & Nuances';
    const gradeCorrectActive = qState.grade === 'correct' ? 'active' : '';
    const gradeIncorrectActive = qState.grade === 'incorrect' ? 'active' : '';

    cardsHTML += `
      <div class="vocab-card-item" id="vocab-card-${qIndex}" style="border-left: 4px solid ${qState.grade === 'correct' ? 'var(--sage)' : qState.grade === 'incorrect' ? 'var(--terracotta)' : 'var(--border-color)'}">
        <div class="vocab-card-header">
          <span>Card ${qIndex + 1} of 20</span>
          <span>Fill-in-the-blank</span>
        </div>
        
        <div style="background-color: var(--input-bg); padding: 1.25rem 1.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div class="speaker-label">In Context</div>
          <div class="text-target" style="font-size: 1.15rem; line-height: 1.6; margin-bottom: 0;">${q.sentence}</div>
        </div>

        <div class="quiz-options-list" style="margin-top: 0.5rem;">
          ${optionsHTML}
        </div>

        <div style="margin-top: 0.5rem; display: flex; gap: 1rem;">
          <button class="btn-secondary btn-small btn-vocab-reveal" data-qindex="${qIndex}">
            ${revealBtnText}
          </button>
        </div>

        <div class="vocab-answer-block" id="vocab-answer-block-${qIndex}" style="${answerBlockStyle}">
          <div class="speaker-label" style="color: var(--warm-gold); font-weight: 500; font-size: 0.8rem;">Partner Key / Translation Details</div>
          <h4 style="font-family: Lora; font-style: italic; font-size: 1.4rem; margin-bottom: 0.5rem; color: var(--terracotta);">
            "${q.word}"
          </h4>
          <p style="font-family: Outfit; font-size: 0.95rem; margin-bottom: 0.5rem;">
            Meaning: <strong>${q.definition}</strong>
          </p>
          <p style="font-size: 0.9rem; color: var(--text-muted); font-style: italic; margin-bottom: 0.5rem;">
            Translation: ${q.sentenceTranslation}
          </p>
          <div class="explanation-text" style="margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
            ${q.explanation}
          </div>
        </div>

        <div class="vocab-grade-buttons">
          <span class="speaker-label" style="margin-bottom: 0; margin-right: 0.5rem;">Partner Grade:</span>
          <button class="btn-vocab-grade grade-correct ${gradeCorrectActive}" data-qindex="${qIndex}" data-grade="correct">
            Correct 🟢
          </button>
          <button class="btn-vocab-grade grade-incorrect ${gradeIncorrectActive}" data-qindex="${qIndex}" data-grade="incorrect">
            Incorrect 🔴
          </button>
        </div>
      </div>
    `;
  });

  let correctCount = 0;
  let gradedCount = 0;
  Object.values(activeEx.answers).forEach(val => {
    if (val.grade === 'correct') {
      correctCount++;
      gradedCount++;
    } else if (val.grade === 'incorrect') {
      gradedCount++;
    }
  });

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">Vocabulary Cards</h3>
        <div class="content-subtitle">Take turns holding the phone and grading each other</div>
      </div>
      <div style="display: flex; align-items: center;">
        <span class="tag tag-rose">${state.level}</span>
        ${getDiscardButtonHTML()}
      </div>
    </div>

    <div style="background-color: var(--input-bg); border: 1px solid var(--border-color); padding: 1rem 1.5rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; font-family: 'Outfit', sans-serif;">
      <div>
        <strong>Journal Progress:</strong> ${gradedCount} of 20 graded
      </div>
      <div>
        <strong>Current Score:</strong> <span style="color: var(--terracotta); font-weight: 600;">${correctCount} / 20 correct</span>
      </div>
    </div>

    <div class="vocab-card-deck">
      ${cardsHTML}
    </div>

    <div style="border-top: 1px solid var(--border-color); padding-top: 2rem; text-align: center; margin-top: 2rem;">
      <button id="btn-vocab-deck-finish" class="btn-primary" style="padding: 0.8rem 2.5rem;">Save Vocabulary Journal Entry</button>
    </div>
  `;

  setupDiscardButtonListener();

  const optionCards = container.querySelectorAll('.vocab-deck-option');
  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      const qIndex = parseInt(card.dataset.qindex);
      const oIndex = parseInt(card.dataset.oindex);
      const qState = activeEx.answers[qIndex];
      if (qState.grade !== null) return;

      const siblingCards = container.querySelectorAll(`.vocab-deck-option[data-qindex="${qIndex}"]`);
      siblingCards.forEach(s => s.classList.remove('selected'));

      card.classList.add('selected');
      qState.selectedOptionIndex = oIndex;
    });
  });

  const revealBtns = container.querySelectorAll('.btn-vocab-reveal');
  revealBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const qIndex = parseInt(btn.dataset.qindex);
      const qState = activeEx.answers[qIndex];
      qState.revealed = !qState.revealed;
      
      const answerBlock = document.getElementById(`vocab-answer-block-${qIndex}`);
      answerBlock.style.display = qState.revealed ? 'block' : 'none';
      btn.textContent = qState.revealed ? 'Hide Answer Details' : 'Reveal Answer & Nuances';
    });
  });

  const gradeBtns = container.querySelectorAll('.btn-vocab-grade');
  gradeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const qIndex = parseInt(btn.dataset.qindex);
      const grade = btn.dataset.grade;
      const qState = activeEx.answers[qIndex];

      const parentCard = document.getElementById(`vocab-card-${qIndex}`);
      const siblingGrades = parentCard.querySelectorAll('.btn-vocab-grade');
      
      qState.grade = grade;
      qState.revealed = true;

      siblingGrades.forEach(g => {
        g.classList.remove('active');
        if (g.dataset.grade === grade) {
          g.classList.add('active');
        }
      });

      parentCard.style.borderLeft = `4px solid ${grade === 'correct' ? 'var(--sage)' : 'var(--terracotta)'}`;
      const answerBlock = document.getElementById(`vocab-answer-block-${qIndex}`);
      answerBlock.style.display = 'block';

      const revBtn = parentCard.querySelector('.btn-vocab-reveal');
      revBtn.textContent = 'Hide Answer Details';

      const optCards = parentCard.querySelectorAll('.vocab-deck-option');
      optCards.forEach(oc => oc.disabled = true);

      let newCorrect = 0;
      let newGraded = 0;
      Object.values(activeEx.answers).forEach(val => {
        if (val.grade === 'correct') {
          newCorrect++;
          newGraded++;
        } else if (val.grade === 'incorrect') {
          newGraded++;
        }
      });

      const scoreHeader = container.querySelector('[style*="background-color: var(--input-bg);"]');
      if (scoreHeader) {
        scoreHeader.innerHTML = `
          <div>
            <strong>Journal Progress:</strong> ${newGraded} of 20 graded
          </div>
          <div>
            <strong>Current Score:</strong> <span style="color: var(--terracotta); font-weight: 600;">${newCorrect} / 20 correct</span>
          </div>
        `;
      }
    });
  });

  document.getElementById('btn-vocab-deck-finish').addEventListener('click', () => {
    let finalCorrect = 0;
    let finalGraded = 0;
    Object.values(activeEx.answers).forEach(val => {
      if (val.grade === 'correct') {
        finalCorrect++;
        finalGraded++;
      } else if (val.grade === 'incorrect') {
        finalGraded++;
      }
    });

    if (finalGraded < 20) {
      if (!confirm(`You have only graded ${finalGraded} out of 20 cards. Save progress anyway?`)) {
        return;
      }
    }

    const scoreStr = `${finalCorrect}/${data.questions.length}`;
    const logRecord = {
      title: "Vocabulary Journal",
      mode: 'Vocabulary Match',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`,
      exerciseData: data,
      userProgress: {
        answers: activeEx.answers,
        correctCount: finalCorrect
      }
    };
    saveToHistory(logRecord);
    state.activeExercises.vocabulary = null;
    saveStateToServer();

    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Vocabulary set completed</h3>
        <p style="margin-bottom: 2rem;">You successfully identified ${finalCorrect} out of 20 words correctly in context.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// Mode C: LISTENING COMPREHENSION RENDERER
function renderListeningExercise(activeEx) {
  const data = activeEx.data;
  const container = document.getElementById('study-workspace');
  let cardsHTML = '';

  data.exercises.forEach((ex, index) => {
    let optionsHTML = '';
    const selectedOIndex = activeEx.answers[index] !== undefined ? activeEx.answers[index] : null;
    const answered = selectedOIndex !== null;
    const correctIdx = ex.answerIndex;

    ex.options.forEach((opt, oIndex) => {
      let optionClass = 'option-card listening-option';
      if (answered) {
        if (oIndex === correctIdx) optionClass += ' correct';
        else if (oIndex === selectedOIndex) optionClass += ' incorrect';
      }
      optionsHTML += `
        <button class="option-card ${optionClass}" data-index="${index}" data-oindex="${oIndex}" ${answered ? 'disabled' : ''}>
          <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
          <div>${opt}</div>
        </button>
      `;
    });

    const isVisible = index === activeEx.activeIndex ? 'block' : 'none';
    const transVisible = activeEx.showTranscription ? 'block' : 'none';
    const feedbackVisible = answered ? 'block' : 'none';
    const feedbackTitle = answered ? (selectedOIndex === correctIdx ? 'Accurate Listening' : 'Misheard Details') : '';
    const feedbackClass = answered ? (selectedOIndex === correctIdx ? 'feedback-panel feedback-success' : 'feedback-panel feedback-error') : 'feedback-panel feedback-neutral';

    cardsHTML += `
      <div class="listening-card" id="listening-card-${index}" style="display: ${isVisible};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
          <span class="tag tag-slate">Audio Passage ${index + 1} of ${data.exercises.length}</span>
        </div>
        
        <div class="hero-gradient-card deep-water" style="text-align: center;">
          <div class="hero-content" style="margin: 0 auto;">
            <button class="btn-tts" onclick="speak('${ex.audioPhrase.replace(/'/g, "\\'")}')" style="background-color: var(--terracotta); padding: 0.8rem 1.8rem; font-size: 1.1rem; border-radius: var(--radius-md);">
              🔊 Listen to sentence
            </button>
            <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--blush-rose);">Click to play or replay audio phrase</p>
          </div>
        </div>

        <div class="listening-transcription" style="display: ${transVisible}; background-color: var(--input-bg); padding: 1.2rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin: 1.5rem 0;">
          <div class="speaker-label">Transcription</div>
          <div class="text-target">${ex.audioPhrase}</div>
          <div class="text-translation" style="margin-top: 0.4rem;">${ex.translation}</div>
        </div>

        <div class="question-section" style="margin-top: 2rem;">
          <h4 style="font-family: Outfit; font-size: 1.1rem; margin-bottom: 0.8rem;">Question:</h4>
          <p style="font-family: Lora; font-size: 1.15rem; font-style: italic; margin-bottom: 1.5rem;">${ex.question}</p>
          <div class="quiz-options-list">${optionsHTML}</div>
        </div>

        <div class="${feedbackClass}" id="listening-feedback-${index}" style="display: ${feedbackVisible};">
          <div class="feedback-title" id="listening-feedback-title-${index}">${feedbackTitle}</div>
          <div class="explanation-text">${ex.explanation}</div>
        </div>
      </div>
    `;
  });

  const transBtnText = activeEx.showTranscription ? 'Hide Text Transcription' : 'Show Text Transcription';

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">Listening Laboratory</h3>
        <div class="content-subtitle">Listen closely to target language audios and test comprehension</div>
      </div>
      <div style="display: flex; align-items: center;">
        <span class="tag tag-slate">${state.level}</span>
        ${getDiscardButtonHTML()}
      </div>
    </div>

    <div class="exercise-container">
      <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
        <button id="btn-toggle-listening-trans" class="btn-secondary">${transBtnText}</button>
      </div>

      ${cardsHTML}

      <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 1.5rem; margin-top: 2.5rem;">
        <button id="btn-listening-prev" class="btn-secondary" style="visibility: ${activeEx.activeIndex > 0 ? 'visible' : 'hidden'};">Previous</button>
        <button id="btn-listening-next" class="btn-primary" style="display: none;">Next Audio</button>
        <button id="btn-listening-finish" class="btn-primary" style="display: none;">Save to Log</button>
      </div>
    </div>
  `;

  setupDiscardButtonListener();

  const nextBtn = document.getElementById('btn-listening-next');
  const prevBtn = document.getElementById('btn-listening-prev');
  const finishBtn = document.getElementById('btn-listening-finish');

  const currentAnswered = activeEx.answers[activeEx.activeIndex] !== undefined;
  if (currentAnswered) {
    if (activeEx.activeIndex < data.exercises.length - 1) {
      nextBtn.style.display = 'inline-flex';
    } else {
      finishBtn.style.display = 'inline-flex';
    }
  }

  const transBtn = document.getElementById('btn-toggle-listening-trans');
  transBtn.addEventListener('click', () => {
    activeEx.showTranscription = !activeEx.showTranscription;
    const transcriptions = document.querySelectorAll('.listening-transcription');
    transcriptions.forEach(el => el.style.display = activeEx.showTranscription ? 'block' : 'none');
    transBtn.textContent = activeEx.showTranscription ? 'Hide Text Transcription' : 'Show Text Transcription';
  });

  const options = container.querySelectorAll('.listening-option');
  options.forEach(card => {
    card.addEventListener('click', () => {
      const exIndex = parseInt(card.dataset.index);
      const oIndex = parseInt(card.dataset.oindex);
      
      if (activeEx.answers[exIndex] !== undefined) return;
      activeEx.answers[exIndex] = oIndex;
      const correctIdx = data.exercises[exIndex].answerIndex;

      const feedbackBox = document.getElementById(`listening-feedback-${exIndex}`);
      const feedbackTitle = document.getElementById(`listening-feedback-title-${exIndex}`);
      feedbackBox.style.display = 'block';

      const siblings = container.querySelectorAll(`.listening-option[data-index="${exIndex}"]`);
      siblings.forEach((s, idx) => {
        s.disabled = true;
        if (idx === correctIdx) s.classList.add('correct');
        else if (idx === oIndex) s.classList.add('incorrect');
      });

      if (oIndex === correctIdx) {
        feedbackBox.className = "feedback-panel feedback-success";
        feedbackTitle.textContent = "Accurate Listening";
        activeEx.correctCount++;
      } else {
        feedbackBox.className = "feedback-panel feedback-error";
        feedbackTitle.textContent = "Misheard Details";
      }

      if (activeEx.activeIndex < data.exercises.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    });
  });

  nextBtn.addEventListener('click', () => {
    document.getElementById(`listening-card-${activeEx.activeIndex}`).style.display = 'none';
    activeEx.activeIndex++;
    document.getElementById(`listening-card-${activeEx.activeIndex}`).style.display = 'block';
    
    prevBtn.style.visibility = 'visible';
    nextBtn.style.display = 'none';

    const answered = activeEx.answers[activeEx.activeIndex] !== undefined;
    if (answered) {
      if (activeEx.activeIndex < data.exercises.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    }
  });

  prevBtn.addEventListener('click', () => {
    document.getElementById(`listening-card-${activeEx.activeIndex}`).style.display = 'none';
    activeEx.activeIndex--;
    document.getElementById(`listening-card-${activeEx.activeIndex}`).style.display = 'block';
    
    if (activeEx.activeIndex === 0) {
      prevBtn.style.visibility = 'hidden';
    }
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';

    const answered = activeEx.answers[activeEx.activeIndex] !== undefined;
    if (answered) {
      if (activeEx.activeIndex < data.exercises.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    }
  });

  finishBtn.addEventListener('click', () => {
    const scoreStr = `${activeEx.correctCount}/${data.exercises.length}`;
    const logRecord = {
      title: "Listening Laboratory",
      mode: 'Listening Comprehension',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`,
      exerciseData: data,
      userProgress: {
        answers: activeEx.answers,
        correctCount: activeEx.correctCount
      }
    };
    saveToHistory(logRecord);
    state.activeExercises.listening = null;
    saveStateToServer();

    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Listening Session Logged</h3>
        <p style="margin-bottom: 2rem;">You answered ${activeEx.correctCount} out of ${data.exercises.length} listening questions correctly.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// Mode D: READING COMPREHENSION RENDERER
function renderReadingExercise(activeEx) {
  const data = activeEx.data;
  const container = document.getElementById('study-workspace');
  
  let vocabNotesHTML = '';
  const vocabNotes = data.vocabularyNotes || data.vocabulary_notes || [];
  vocabNotes.forEach(item => {
    vocabNotesHTML += `
      <div class="vocab-item">
        <span class="vocab-term">${item.term || item.word || ''}</span>
        <span class="vocab-meaning">${item.meaning || item.translation || ''}</span>
      </div>
    `;
  });

  let questionsHTML = '';
  data.questions.forEach((q, qIndex) => {
    let optionsHTML = '';
    const selectedOIndex = activeEx.answers[qIndex] !== undefined ? activeEx.answers[qIndex] : null;
    const answered = selectedOIndex !== null;
    const correctIdx = q.answerIndex;

    q.options.forEach((opt, oIndex) => {
      let optionClass = 'option-card reading-option';
      if (answered) {
        if (oIndex === correctIdx) optionClass += ' correct';
        else if (oIndex === selectedOIndex) optionClass += ' incorrect';
      }
      optionsHTML += `
        <button class="option-card ${optionClass}" data-qindex="${qIndex}" data-oindex="${oIndex}" ${answered ? 'disabled' : ''}>
          <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
          <div>${opt}</div>
        </button>
      `;
    });

    const isVisible = qIndex === activeEx.activeIndex ? 'block' : 'none';
    const feedbackVisible = answered ? 'block' : 'none';
    const feedbackTitle = answered ? (selectedOIndex === correctIdx ? 'Correct Interpretation' : 'Misinterpretation Corrected') : '';
    const feedbackClass = answered ? (selectedOIndex === correctIdx ? 'feedback-panel feedback-success' : 'feedback-panel feedback-error') : 'feedback-panel feedback-neutral';

    questionsHTML += `
      <div class="reading-q-box" id="reading-q-${qIndex}" style="display: ${isVisible}; margin-top: 2rem;">
        <h4 style="font-family: Outfit; font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--text-muted);">Comprehension Question ${qIndex + 1} of ${data.questions.length}</h4>
        <p style="font-family: Lora; font-size: 1.15rem; font-style: italic;">${q.question}</p>
        <div class="quiz-options-list">${optionsHTML}</div>
        
        <div class="${feedbackClass}" id="reading-feedback-${qIndex}" style="display: ${feedbackVisible}; margin-top: 1.5rem;">
          <div class="feedback-title" id="reading-feedback-title-${qIndex}">${feedbackTitle}</div>
          <div class="explanation-text">${q.explanation}</div>
        </div>
      </div>
    `;
  });

  const translationStyle = activeEx.showTranslation ? 'display: block;' : 'display: none;';
  const translationBtnText = activeEx.showTranslation ? 'Hide Text Translation' : 'Show Text Translation';

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">Philosophical Reading Journal</h3>
        <div class="content-subtitle">Editorial Reflection Analysis</div>
      </div>
      <div style="display: flex; align-items: center;">
        <span class="tag tag-sage">${state.level}</span>
        ${getDiscardButtonHTML()}
      </div>
    </div>

    <div class="exercise-container" style="max-width: 800px; margin: 0 auto;">
      <div class="hero-gradient-card mediterranean" style="padding: 1.5rem 2rem; margin-bottom: 2rem;">
        <div class="hero-content">
          <h4 style="font-family: Outfit; font-weight: 500; font-size: 1rem;">${data.title}</h4>
        </div>
      </div>

      <article class="reading-passage">${data.passage}</article>

      <div class="translation-toggle-bar">
        <button id="btn-toggle-reading-trans" class="btn-secondary">${translationBtnText}</button>
      </div>

      <div id="reading-translation-box" style="${translationStyle} background-color: var(--input-bg); border-left: 3px solid var(--blush-rose); padding: 1.5rem; border-radius: var(--radius-sm); margin-bottom: 2rem; font-style: italic; font-size: 1rem;">
        ${data.translation}
      </div>

      <div class="reading-vocab-notes">
        <div class="reading-vocab-title">Glossary & Nuance Notes</div>
        <div class="vocab-grid">${vocabNotesHTML}</div>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 2rem; margin-top: 3rem;">
        <h3 style="font-family: Outfit; margin-bottom: 1.5rem; text-align: center;">Reflective Inquiries</h3>
        ${questionsHTML}

        <div style="display: flex; justify-content: space-between; margin-top: 2rem;">
          <button id="btn-reading-prev" class="btn-secondary" style="visibility: ${activeEx.activeIndex > 0 ? 'visible' : 'hidden'};">Previous</button>
          <button id="btn-reading-next" class="btn-primary" style="display: none;">Next Inquiry</button>
          <button id="btn-reading-finish" class="btn-primary" style="display: none;">Conclude Session</button>
        </div>
      </div>
    </div>
  `;

  setupDiscardButtonListener();

  const nextBtn = document.getElementById('btn-reading-next');
  const prevBtn = document.getElementById('btn-reading-prev');
  const finishBtn = document.getElementById('btn-reading-finish');

  const currentAnswered = activeEx.answers[activeEx.activeIndex] !== undefined;
  if (currentAnswered) {
    if (activeEx.activeIndex < data.questions.length - 1) {
      nextBtn.style.display = 'inline-flex';
    } else {
      finishBtn.style.display = 'inline-flex';
    }
  }

  const transBtn = document.getElementById('btn-toggle-reading-trans');
  transBtn.addEventListener('click', () => {
    activeEx.showTranslation = !activeEx.showTranslation;
    const box = document.getElementById('reading-translation-box');
    box.style.display = activeEx.showTranslation ? 'block' : 'none';
    transBtn.textContent = activeEx.showTranslation ? 'Hide Text Translation' : 'Show Text Translation';
  });

  const optionCards = container.querySelectorAll('.reading-option');
  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      const qIndex = parseInt(card.dataset.qindex);
      const oIndex = parseInt(card.dataset.oindex);

      if (activeEx.answers[qIndex] !== undefined) return;
      activeEx.answers[qIndex] = oIndex;
      const correctIdx = data.questions[qIndex].answerIndex;

      const feedbackBox = document.getElementById(`reading-feedback-${qIndex}`);
      const feedbackTitle = document.getElementById(`reading-feedback-title-${qIndex}`);
      feedbackBox.style.display = 'block';

      const siblings = container.querySelectorAll(`.reading-option[data-qindex="${qIndex}"]`);
      siblings.forEach((s, idx) => {
        s.disabled = true;
        if (idx === correctIdx) s.classList.add('correct');
        else if (idx === oIndex) s.classList.add('incorrect');
      });

      if (oIndex === correctIdx) {
        feedbackBox.className = "feedback-panel feedback-success";
        feedbackTitle.textContent = "Correct Interpretation";
        activeEx.correctCount++;
      } else {
        feedbackBox.className = "feedback-panel feedback-error";
        feedbackTitle.textContent = "Misinterpretation Corrected";
      }

      if (activeEx.activeIndex < data.questions.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    });
  });

  nextBtn.addEventListener('click', () => {
    document.getElementById(`reading-q-${activeEx.activeIndex}`).style.display = 'none';
    activeEx.activeIndex++;
    document.getElementById(`reading-q-${activeEx.activeIndex}`).style.display = 'block';
    
    prevBtn.style.visibility = 'visible';
    nextBtn.style.display = 'none';

    const answered = activeEx.answers[activeEx.activeIndex] !== undefined;
    if (answered) {
      if (activeEx.activeIndex < data.questions.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    }
  });

  prevBtn.addEventListener('click', () => {
    document.getElementById(`reading-q-${activeEx.activeIndex}`).style.display = 'none';
    activeEx.activeIndex--;
    document.getElementById(`reading-q-${activeEx.activeIndex}`).style.display = 'block';
    
    if (activeEx.activeIndex === 0) {
      prevBtn.style.visibility = 'hidden';
    }
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';

    const answered = activeEx.answers[activeEx.activeIndex] !== undefined;
    if (answered) {
      if (activeEx.activeIndex < data.questions.length - 1) {
        nextBtn.style.display = 'inline-flex';
      } else {
        finishBtn.style.display = 'inline-flex';
      }
    }
  });

  finishBtn.addEventListener('click', () => {
    const scoreStr = `${activeEx.correctCount}/${data.questions.length}`;
    const logRecord = {
      title: data.title,
      mode: 'Reading Passage',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`,
      exerciseData: data,
      userProgress: {
        answers: activeEx.answers,
        correctCount: activeEx.correctCount
      }
    };
    saveToHistory(logRecord);
    state.activeExercises.reading = null;
    saveStateToServer();

    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Reading Session Completed</h3>
        <p style="margin-bottom: 2rem;">Your reflection journal entry has been registered successfully. You answered ${activeEx.correctCount} out of ${data.questions.length} comprehension inquiries correctly.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// Mode E: CONVERSATION PRACTICE RENDERER (No text inputs, Partner Graded)
function renderConversationExercise(activeEx) {
  const data = activeEx.data;
  const container = document.getElementById('study-workspace');
  
  let stepsHTML = '';
  data.steps.forEach((step, sIndex) => {
    const currentGrade = activeEx.grades[sIndex] || null;
    
    // Tips HTML
    let tipsHTML = '';
    if (step.tips && step.tips.length > 0) {
      tipsHTML += `
        <div style="margin-top: 0.8rem;">
          <span class="speaker-label" style="margin-bottom: 0.2rem;">Help ${activeEx.learnerName} (Tips if stuck):</span>
          <ul style="list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 0.4rem;">
      `;
      step.tips.forEach((tipText) => {
        const isFlagged = activeEx.difficultWords.includes(tipText);
        const activeClass = isFlagged ? 'active grade-incorrect' : '';
        
        tipsHTML += `
          <li style="display: flex; align-items: center; justify-content: space-between; background-color: var(--input-bg); padding: 0.5rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.9rem;">
            <span>${tipText}</span>
            <button class="btn-vocab-grade btn-vocab-tip-toggle ${activeClass}" data-step="${sIndex}" data-word="${tipText.replace(/"/g, '&quot;')}" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; flex-shrink: 0; margin-left: 1rem;">
              Practice 📌
            </button>
          </li>
        `;
      });
      tipsHTML += '</ul></div>';
    }

    stepsHTML += `
      <div class="vocab-card-item" id="roleplay-step-${sIndex}" style="border-left: 4px solid ${currentGrade === 'coherent' ? 'var(--sage)' : currentGrade === 'effort' ? 'var(--warm-gold)' : currentGrade === 'revisions' ? 'var(--terracotta)' : 'var(--border-color)'}; gap: 1rem;">
        <div class="vocab-card-header">
          <span>Step ${sIndex + 1} of ${data.steps.length}</span>
          <span>Timeline Prompt</span>
        </div>
        
        <!-- Guide Action -->
        <div style="background-color: rgba(123, 145, 184, 0.08); padding: 1rem 1.25rem; border-radius: var(--radius-sm); border-left: 3px solid var(--slate-blue);">
          <div class="speaker-label" style="color: var(--slate-blue); font-weight: 500; font-size: 0.75rem;">Your Action (Expert: ${activeEx.guideName})</div>
          <div class="text-target" style="font-size: 1.1rem; line-height: 1.5; margin-bottom: 0;">${step.guideAction}</div>
        </div>

        <!-- Learner Task -->
        <div style="background-color: rgba(232, 176, 154, 0.08); padding: 1rem 1.25rem; border-radius: var(--radius-sm); border-left: 3px solid var(--blush-rose);">
          <div class="speaker-label" style="color: var(--terracotta); font-weight: 500; font-size: 0.75rem;">${activeEx.learnerName}'s Task</div>
          <div style="font-size: 1.05rem; line-height: 1.5;">${step.learnerTask}</div>
        </div>

        <!-- Tips if stuck -->
        ${tipsHTML}

        <!-- Grading for this step -->
        <div style="border-top: 1px solid var(--border-color); padding-top: 0.8rem; margin-top: 0.5rem;">
          <div class="speaker-label" style="margin-bottom: 0.4rem; font-size: 0.75rem;">Grade ${activeEx.learnerName}'s Response:</div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn-grade ${currentGrade === 'coherent' ? 'active' : ''}" data-step="${sIndex}" data-grade="coherent" style="flex: 1; min-width: 100px; padding: 0.4rem 0.8rem; justify-content: center;">
              <span>Fluent 🟢</span>
            </button>
            <button class="btn-grade ${currentGrade === 'effort' ? 'active' : ''}" data-step="${sIndex}" data-grade="effort" style="flex: 1; min-width: 100px; padding: 0.4rem 0.8rem; justify-content: center;">
              <span>Effort 🟡</span>
            </button>
            <button class="btn-grade ${currentGrade === 'revisions' ? 'active' : ''}" data-step="${sIndex}" data-grade="revisions" style="flex: 1; min-width: 100px; padding: 0.4rem 0.8rem; justify-content: center;">
              <span>Practice 🔴</span>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">Conversation Lab</h3>
        <div class="content-subtitle">Expert-guided interactive roleplay</div>
      </div>
      <div style="display: flex; align-items: center;">
        <span class="tag tag-rose">${state.level}</span>
        ${getDiscardButtonHTML()}
      </div>
    </div>

    <!-- Roleplay Setup Header Banner -->
    <div style="background-color: var(--input-bg); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem; border-left: 4px solid var(--terracotta);">
      <div style="display: flex; justify-content: space-between; align-items: center; font-family: Outfit; font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <span><strong>Learner:</strong> ${activeEx.learnerName} (Role: ${data.learnerRole})</span>
          <span style="margin: 0 0.5rem; color: var(--border-color);">|</span>
          <span><strong>Guide/Expert:</strong> ${activeEx.guideName} (Role: ${data.guideRole})</span>
        </div>
        <button id="btn-swap-roles" class="btn-secondary btn-small" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; border-color: var(--terracotta); color: var(--terracotta);">
          Swap Roles 🔁
        </button>
      </div>
      <h4 style="font-family: Outfit; font-weight: 500; font-size: 1.15rem; color: var(--terracotta); margin-top: 0.8rem; margin-bottom: 0.4rem;">
        Roleplay Scenario: ${data.topic}
      </h4>
      <p style="font-family: Lora; font-style: italic; font-size: 1.05rem; margin-bottom: 0; line-height: 1.6;">
        ${data.scenario}
      </p>
    </div>

    <div class="vocab-card-deck">
      ${stepsHTML}
    </div>

    <div style="border-top: 1px solid var(--border-color); padding-top: 2rem; text-align: center; margin-top: 2rem;">
      <button id="btn-conclude-conversation" class="btn-primary" style="padding: 0.8rem 2.5rem;">Conclude & Save Roleplay Session</button>
    </div>
  `;

  setupDiscardButtonListener();

  // Attach swap roles listener
  const swapRolesBtn = document.getElementById('btn-swap-roles');
  if (swapRolesBtn) {
    swapRolesBtn.addEventListener('click', () => {
      // Swap names
      const tempName = activeEx.learnerName;
      activeEx.learnerName = activeEx.guideName;
      activeEx.guideName = tempName;

      // Swap roles inside data
      const tempRole = data.learnerRole;
      data.learnerRole = data.guideRole;
      data.guideRole = tempRole;

      // Re-render
      renderConversationExercise(activeEx);
    });
  }

  // Attach grading click events for each step
  const gradeButtons = container.querySelectorAll('.btn-grade');
  gradeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const stepIndex = parseInt(btn.dataset.step);
      const grade = btn.dataset.grade;
      
      activeEx.grades[stepIndex] = grade;

      // Update button styling for this step
      const stepContainer = document.getElementById(`roleplay-step-${stepIndex}`);
      const siblingBtns = stepContainer.querySelectorAll('.btn-grade');
      siblingBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update card left border color
      const borderColorMap = {
        coherent: 'var(--sage)',
        effort: 'var(--warm-gold)',
        revisions: 'var(--terracotta)'
      };
      stepContainer.style.borderLeft = `4px solid ${borderColorMap[grade]}`;
    });
  });

  // Attach toggles for vocabulary tip flagging
  const tipToggles = container.querySelectorAll('.btn-vocab-tip-toggle');
  tipToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word;
      const index = activeEx.difficultWords.indexOf(word);
      
      if (index === -1) {
        // Flag it as difficult
        activeEx.difficultWords.push(word);
        btn.classList.add('active', 'grade-incorrect');
      } else {
        // Unflag it
        activeEx.difficultWords.splice(index, 1);
        btn.classList.remove('active', 'grade-incorrect');
      }
    });
  });

  // Conclude / Save Session
  document.getElementById('btn-conclude-conversation').addEventListener('click', () => {
    const totalSteps = data.steps.length;
    let gradedCount = 0;
    let fluentCount = 0;
    
    for (let i = 0; i < totalSteps; i++) {
      if (activeEx.grades[i]) {
        gradedCount++;
        if (activeEx.grades[i] === 'coherent') fluentCount++;
      }
    }

    if (gradedCount < totalSteps) {
      if (!confirm(`You have only graded ${gradedCount} out of ${totalSteps} roleplay steps. Conclude anyway?`)) {
        return;
      }
    }

    const scoreStr = `Roleplay Graded: ${fluentCount}/${totalSteps} Fluent`;
    const logRecord = {
      title: `Conversation: ${data.topic}`,
      mode: 'Active Conversation',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`,
      exerciseData: data,
      userProgress: {
        learnerName: activeEx.learnerName,
        guideName: activeEx.guideName,
        grades: activeEx.grades,
        difficultWords: activeEx.difficultWords
      }
    };
    saveToHistory(logRecord);
    state.activeExercises.conversation = null;
    saveStateToServer();

    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Conversation Journal Saved</h3>
        <p style="margin-bottom: 2rem;">The roleplay has been successfully logged. Words flagged for practice will be reinforced in future exercises.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// ----------------------------------------------------
// 8. RENDER HISTORY LIST & DETAIL MODAL
// ----------------------------------------------------
function renderHistoryList() {
  const container = document.getElementById('history-list');
  if (state.history.length === 0) {
    container.innerHTML = '<div class="history-empty">No practice logs recorded yet. Complete an exercise to write in the journal.</div>';
    return;
  }

  let html = '';
  state.history.forEach(item => {
    let dateStr = "";
    try {
      dateStr = new Date(item.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch(e) {
      dateStr = item.timestamp || "";
    }

    let pathText = "German ➔ Swedish";
    if (item.languagePair === 'swedish-german') pathText = "Swedish ➔ German";
    else if (item.languagePair === 'italian-english') pathText = "Italian ➔ English";

    html += `
      <div class="history-item" onclick="viewHistoryDetail('${item.id}')" style="cursor: pointer;">
        <div>
          <div class="history-meta-title">${item.title}</div>
          <div class="history-meta-details">
            ${item.mode} &bull; ${pathText} &bull; ${item.level} &bull; ${dateStr}
          </div>
        </div>
        <div class="history-score">
          ${item.score}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function viewHistoryDetail(itemId) {
  const item = state.history.find(h => h.id === itemId);
  if (!item) return;

  const titleEl = document.getElementById('history-detail-title');
  const bodyEl = document.getElementById('history-detail-body');
  const modal = document.getElementById('modal-history-detail');

  titleEl.textContent = `Journal Review: ${item.title}`;

  let html = '';
  let pathText = "German ➔ Swedish";
  if (item.languagePair === 'swedish-german') pathText = "Swedish ➔ German";
  else if (item.languagePair === 'italian-english') pathText = "Italian ➔ English";

  html += `
    <div class="review-meta-bar">
      <span><strong>Mode:</strong> ${item.mode}</span>
      <span>&bull;</span>
      <span><strong>Path:</strong> ${pathText}</span>
      <span>&bull;</span>
      <span><strong>Level:</strong> ${item.level}</span>
      <span>&bull;</span>
      <span><strong>Score/Grading:</strong> ${item.score}</span>
      <span>&bull;</span>
      <span><strong>Partners:</strong> ${item.partners}</span>
    </div>
  `;

  const data = item.exerciseData;
  const prog = item.userProgress;

  if (!data) {
    html += `<p style="font-style: italic; color: var(--text-muted); text-align: center; margin-top: 2rem;">No detailed content was saved for this older exercise.</p>`;
  } else {
    if (item.mode === 'Pimsleur Story') {
      html += `<div class="review-section-title">Scenario Context</div>`;
      html += `<p style="font-style: italic; color: var(--text-muted);">${data.scenario}</p>`;

      html += `<div class="review-section-title">Dialogue Thread</div>`;
      let dialogueHTML = '<div class="dialogue-thread">';
      data.dialogue.forEach((line, index) => {
        const isPartnerA = index % 2 === 0;
        const speakerClass = isPartnerA ? 'bubble-partner-a' : 'bubble-partner-b';
        const speakerName = line.speaker || (isPartnerA ? item.partners.split('&')[0].trim() : item.partners.split('&')[1].trim());
        dialogueHTML += `
          <div class="dialogue-bubble ${speakerClass}" style="max-width: 90%; align-self: ${isPartnerA ? 'flex-start' : 'flex-end'};">
            <span class="speaker-label">${speakerName}</span>
            <div class="text-target" style="font-size: 1.05rem;">${line.text}</div>
            <div class="text-translation" style="display: block; font-size: 0.9rem;">${line.translation}</div>
          </div>
        `;
      });
      dialogueHTML += '</div>';
      html += dialogueHTML;

      html += `<div class="review-section-title">Comprehension Inquiries</div>`;
      data.comprehension.forEach((q, qIndex) => {
        const selectedOIndex = prog && prog.answers ? prog.answers[qIndex] : null;
        const correctIdx = q.answerIndex;
        let optionsHTML = '';
        
        q.options.forEach((opt, oIndex) => {
          let optionClass = 'option-card';
          if (oIndex === correctIdx) optionClass += ' correct';
          else if (oIndex === selectedOIndex) optionClass += ' incorrect';
          
          optionsHTML += `
            <div class="${optionClass}" style="padding: 0.6rem 1rem; font-size: 0.9rem; margin-bottom: 0.5rem; pointer-events: none;">
              <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
              <div>${opt}</div>
            </div>
          `;
        });

        html += `
          <div style="background-color: var(--input-bg); padding: 1.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 1rem;">
            <p style="font-weight: 500; font-size: 1rem; margin-bottom: 0.5rem;">Q${qIndex + 1}: ${q.question}</p>
            <div class="quiz-options-list" style="margin-top: 0.5rem;">${optionsHTML}</div>
            <div class="explanation-text" style="margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
              <strong>Explanation:</strong> ${q.explanation}
            </div>
          </div>
        `;
      });
    } else if (item.mode === 'Vocabulary Match') {
      html += `<div class="review-section-title">Graded Vocabulary Cards</div>`;
      data.questions.forEach((q, qIndex) => {
        const cardProg = prog && prog.answers ? prog.answers[qIndex] : null;
        const grade = cardProg ? cardProg.grade : null;
        const selectedOIndex = cardProg ? cardProg.selectedOptionIndex : null;
        
        let optionsHTML = '';
        q.options.forEach((opt, oIndex) => {
          let optionClass = 'option-card';
          if (opt === q.correctAnswer) optionClass += ' correct';
          else if (selectedOIndex === oIndex) optionClass += ' incorrect';
          
          optionsHTML += `
            <div class="${optionClass}" style="padding: 0.5rem 0.8rem; font-size: 0.9rem; margin-bottom: 0.4rem; pointer-events: none;">
              <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
              <div>${opt}</div>
            </div>
          `;
        });

        const gradeLabel = grade === 'correct' ? '<span style="color: var(--sage); font-weight: 600;">Correct 🟢</span>' : 
                           grade === 'incorrect' ? '<span style="color: var(--terracotta); font-weight: 600;">Incorrect 🔴</span>' : 
                           '<span style="color: var(--text-muted);">Ungraded</span>';

        html += `
          <div style="background-color: var(--card-bg); padding: 1.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 1.5rem; border-left: 4px solid ${grade === 'correct' ? 'var(--sage)' : grade === 'incorrect' ? 'var(--terracotta)' : 'var(--border-color)'}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-family: Outfit; font-size: 0.8rem; color: var(--text-muted);">
              <span>Card ${qIndex + 1}</span>
              <span>Grade: ${gradeLabel}</span>
            </div>
            <p style="font-size: 1.05rem; margin-bottom: 0.5rem;">Sentence: <strong>${q.sentence.replace('___', `[ ${q.word} ]`)}</strong></p>
            <p style="font-size: 0.9rem; color: var(--text-muted); font-style: italic; margin-bottom: 0.75rem;">Translation: ${q.sentenceTranslation}</p>
            
            <div class="quiz-options-list" style="margin-top: 0.5rem;">${optionsHTML}</div>
            
            <div class="vocab-answer-block" style="display: block; margin-top: 0.75rem; padding: 0.75rem 1rem;">
              <p style="font-weight: 500; font-size: 0.95rem; margin-bottom: 0.25rem;">Word Analysis: <span style="color: var(--terracotta); font-style: italic;">"${q.word}"</span></p>
              <p style="font-size: 0.9rem; margin-bottom: 0.25rem;">Definition: ${q.definition}</p>
              <div class="explanation-text" style="margin-top: 0.25rem; border-top: 1px solid var(--border-color); padding-top: 0.25rem;">${q.explanation}</div>
            </div>
          </div>
        `;
      });
    } else if (item.mode === 'Listening Comprehension') {
      html += `<div class="review-section-title">Comprehension Passages</div>`;
      data.exercises.forEach((ex, index) => {
        const selectedOIndex = prog && prog.answers ? prog.answers[index] : null;
        const correctIdx = ex.answerIndex;
        let optionsHTML = '';

        ex.options.forEach((opt, oIndex) => {
          let optionClass = 'option-card';
          if (oIndex === correctIdx) optionClass += ' correct';
          else if (oIndex === selectedOIndex) optionClass += ' incorrect';

          optionsHTML += `
            <div class="${optionClass}" style="padding: 0.6rem 1rem; font-size: 0.9rem; margin-bottom: 0.5rem; pointer-events: none;">
              <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
              <div>${opt}</div>
            </div>
          `;
        });

        html += `
          <div style="background-color: var(--input-bg); padding: 1.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <p style="font-size: 1.1rem; font-weight: 500; color: var(--terracotta); margin-bottom: 0.25rem;">Audio Phrase: ${ex.audioPhrase}</p>
            <p style="font-size: 0.95rem; color: var(--text-muted); font-style: italic; margin-bottom: 0.75rem;">Translation: ${ex.translation}</p>
            <p style="font-weight: 500; font-size: 1rem; margin-bottom: 0.5rem;">Question: ${ex.question}</p>
            <div class="quiz-options-list">${optionsHTML}</div>
            <div class="explanation-text" style="margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
              <strong>Explanation:</strong> ${ex.explanation}
            </div>
          </div>
        `;
      });
    } else if (item.mode === 'Reading Passage') {
      html += `<div class="review-section-title">Passage Title: ${data.title}</div>`;
      html += `<article class="reading-passage" style="font-size: 1.05rem; line-height: 1.7; margin-bottom: 1.5rem;">${data.passage}</article>`;
      html += `<div style="background-color: var(--input-bg); border-left: 3px solid var(--blush-rose); padding: 1rem 1.25rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem; font-style: italic; font-size: 0.95rem;">${data.translation}</div>`;

      const vocabNotes = data.vocabularyNotes || data.vocabulary_notes || [];
      html += `<div class="reading-vocab-notes" style="padding: 1rem; margin: 1rem 0;">
        <div class="reading-vocab-title">Glossary & Nuances</div>
        <div class="vocab-grid" style="font-size: 0.9rem;">
          ${vocabNotes.map(v => `
            <div class="vocab-item">
              <span class="vocab-term">${v.term || v.word || ''}</span>
              <span class="vocab-meaning">${v.meaning || v.translation || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>`;

      html += `<div class="review-section-title">Comprehension Inquiries</div>`;
      data.questions.forEach((q, qIndex) => {
        const selectedOIndex = prog && prog.answers ? prog.answers[qIndex] : null;
        const correctIdx = q.answerIndex;
        let optionsHTML = '';

        q.options.forEach((opt, oIndex) => {
          let optionClass = 'option-card';
          if (oIndex === correctIdx) optionClass += ' correct';
          else if (oIndex === selectedOIndex) optionClass += ' incorrect';

          optionsHTML += `
            <div class="${optionClass}" style="padding: 0.6rem 1rem; font-size: 0.9rem; margin-bottom: 0.5rem; pointer-events: none;">
              <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
              <div>${opt}</div>
            </div>
          `;
        });

        html += `
          <div style="background-color: var(--input-bg); padding: 1.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 1rem;">
            <p style="font-weight: 500; font-size: 1rem; margin-bottom: 0.5rem;">Q${qIndex + 1}: ${q.question}</p>
            <div class="quiz-options-list">${optionsHTML}</div>
            <div class="explanation-text" style="margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
              <strong>Explanation:</strong> ${q.explanation}
            </div>
          </div>
        `;
      });
    } else if (item.mode === 'Active Conversation') {
      html += `<div class="review-section-title">Active Topic: ${data.topic}</div>`;
      html += `<p style="font-style: italic; color: var(--text-muted); margin-bottom: 1.5rem;">${data.scenario}</p>`;

      if (data.steps) {
        const learnerName = prog && prog.learnerName ? prog.learnerName : 'Learner';
        const guideName = prog && prog.guideName ? prog.guideName : 'Guide';
        const learnerRole = data.learnerRole || '';
        const guideRole = data.guideRole || '';

        html += `
          <div style="background-color: var(--input-bg); border: 1px solid var(--border-color); padding: 1rem 1.25rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
            <div><strong>Learner:</strong> ${learnerName} ${learnerRole ? `(${learnerRole})` : ''}</div>
            <div><strong>Guide/Expert:</strong> ${guideName} ${guideRole ? `(${guideRole})` : ''}</div>
          </div>
          <div class="review-section-title">Roleplay Steps</div>
          <div class="vocab-card-deck">
        `;

        const friendlyGrade = (g) => {
          if (g === 'coherent') return '<span style="color: var(--sage); font-weight: 600;">Fluent 🟢</span>';
          if (g === 'effort') return '<span style="color: var(--warm-gold); font-weight: 600;">Effort 🟡</span>';
          if (g === 'revisions') return '<span style="color: var(--terracotta); font-weight: 600;">Practice Needed 🔴</span>';
          return '<span style="color: var(--text-muted);">Not Graded</span>';
        };

        data.steps.forEach((step, sIndex) => {
          const currentGrade = prog && prog.grades ? prog.grades[sIndex] : null;
          
          let tipsHTML = '';
          if (step.tips && step.tips.length > 0) {
            tipsHTML += `
              <div style="margin-top: 0.8rem;">
                <span class="speaker-label" style="margin-bottom: 0.2rem;">Vocabulary Tips:</span>
                <ul style="list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 0.4rem;">
            `;
            step.tips.forEach((tipText) => {
              const isFlagged = prog && prog.difficultWords && prog.difficultWords.includes(tipText);
              const activeStyle = isFlagged ? 'background-color: var(--input-bg); border-color: var(--terracotta); color: var(--terracotta); font-weight: 500;' : 'background-color: var(--input-bg); border-color: var(--border-color);';
              
              tipsHTML += `
                <li style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid; font-size: 0.9rem; ${activeStyle}">
                  <span>${tipText}</span>
                  ${isFlagged ? '<span style="font-size: 0.75rem; font-family: Outfit; padding: 0.25rem 0.5rem; background: rgba(232,176,154,0.15); border-radius: 4px;">Practice 📌</span>' : ''}
                </li>
              `;
            });
            tipsHTML += '</ul></div>';
          }

          html += `
            <div class="vocab-card-item" style="border-left: 4px solid ${currentGrade === 'coherent' ? 'var(--sage)' : currentGrade === 'effort' ? 'var(--warm-gold)' : currentGrade === 'revisions' ? 'var(--terracotta)' : 'var(--border-color)'}; gap: 1rem; width: 100%;">
              <div class="vocab-card-header">
                <span>Step ${sIndex + 1} of ${data.steps.length}</span>
                <span>Recorded Grade: ${friendlyGrade(currentGrade)}</span>
              </div>
              
              <!-- Guide Action -->
              <div style="background-color: rgba(123, 145, 184, 0.08); padding: 1rem 1.25rem; border-radius: var(--radius-sm); border-left: 3px solid var(--slate-blue);">
                <div class="speaker-label" style="color: var(--slate-blue); font-weight: 500; font-size: 0.75rem;">Guide Action (${guideName})</div>
                <div class="text-target" style="font-size: 1.1rem; line-height: 1.5; margin-bottom: 0;">${step.guideAction}</div>
              </div>

              <!-- Learner Task -->
              <div style="background-color: rgba(232, 176, 154, 0.08); padding: 1rem 1.25rem; border-radius: var(--radius-sm); border-left: 3px solid var(--blush-rose);">
                <div class="speaker-label" style="color: var(--terracotta); font-weight: 500; font-size: 0.75rem;">Learner Task (${learnerName})</div>
                <div style="font-size: 1.05rem; line-height: 1.5;">${step.learnerTask}</div>
              </div>

              <!-- Tips -->
              ${tipsHTML}
            </div>
          `;
        });

        html += `</div>`;
      } else {
        // Fallback for older formats
        const partnerA = item.partners.split('&')[0].trim();
        const partnerB = item.partners.split('&')[1].trim();

        const friendlyGrade = (g) => {
          if (g === 'coherent') return '<span style="color: var(--sage); font-weight: 600;">Coherent & Fluent 🟢</span>';
          if (g === 'effort') return '<span style="color: var(--warm-gold); font-weight: 600;">Understood with effort 🟡</span>';
          if (g === 'revisions') return '<span style="color: var(--terracotta); font-weight: 600;">Needs Practice 🔴</span>';
          return '<span style="color: var(--text-muted);">Not Graded</span>';
        };

        html += `
          <div class="conversation-exercise" style="margin-top: 1rem;">
            <div class="partner-lane" style="padding: 1.25rem;">
              <h4 class="partner-lane-title">${partnerA} (Partner A)</h4>
              <p class="partner-lane-prompt" style="font-size: 0.95rem;">Prompt: ${data.partnerAPrompt}</p>
              <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: 1rem;">
                <strong>Recorded Grade:</strong> <br>${friendlyGrade(prog ? prog.gradeA : null)}
              </div>
            </div>
            <div class="partner-lane" style="padding: 1.25rem;">
              <h4 class="partner-lane-title">${partnerB} (Partner B)</h4>
              <p class="partner-lane-prompt" style="font-size: 0.95rem;">Prompt: ${data.partnerBPrompt}</p>
              <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: 1rem;">
                <strong>Recorded Grade:</strong> <br>${friendlyGrade(prog ? prog.gradeB : null)}
              </div>
            </div>
          </div>
        `;

        html += `
          <div class="form-row" style="margin-top: 2.5rem;">
            <div class="helper-phrases-box" style="margin: 0; padding: 0.8rem 1.2rem;">
              <div class="helper-phrases-title">Vocabulary Helpers</div>
              <ul class="helper-list" style="font-size: 0.85rem; padding-left: 1rem;">
                ${data.helperVocabulary ? data.helperVocabulary.map(v => `<li><strong>${v.phrase}</strong>: <em>${v.translation}</em></li>`).join('') : ''}
              </ul>
            </div>
            <div class="helper-phrases-box" style="margin: 0; padding: 0.8rem 1.2rem;">
              <div class="helper-phrases-title">Starter Phrases</div>
              <ul class="helper-list" style="font-size: 0.85rem; font-style: italic; padding-left: 1rem; color: var(--text-muted);">
                ${data.starterPhrases ? data.starterPhrases.map(p => `<li>${p}</li>`).join('') : ''}
              </ul>
            </div>
          </div>
        `;
      }
    }
  }

  bodyEl.innerHTML = html;
  modal.style.display = 'flex';
}
