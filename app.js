// Sensus Couples Language Learning App State
const state = {
  partnerA: '',
  partnerB: '',
  languagePair: 'german-swedish', // german-swedish, swedish-german, italian-english
  level: 'B2',
  apiKey: '',
  currentMode: 'story', // story, vocabulary, listening, reading, conversation
  history: []
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

function loadSavedSettings() {
  state.partnerA = localStorage.getItem('sensus-partner-a') || '';
  state.partnerB = localStorage.getItem('sensus-partner-b') || '';
  state.languagePair = localStorage.getItem('sensus-language-pair') || 'german-swedish';
  state.level = localStorage.getItem('sensus-level') || 'B2';
  state.apiKey = localStorage.getItem('sensus-api-key') || '';

  if (state.partnerA && state.partnerB) {
    showDashboard();
  } else {
    showSetup();
  }
}

function showSetup() {
  document.getElementById('screen-setup').style.display = 'block';
  document.getElementById('screen-dashboard').style.display = 'none';
  
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

  renderWorkspaceEmptyState();
}

function saveSettings(partnerA, partnerB, langPair, level, apiKey) {
  state.partnerA = partnerA.trim();
  state.partnerB = partnerB.trim();
  state.languagePair = langPair;
  state.level = level;
  state.apiKey = apiKey.trim();

  localStorage.setItem('sensus-partner-a', state.partnerA);
  localStorage.setItem('sensus-partner-b', state.partnerB);
  localStorage.setItem('sensus-language-pair', state.languagePair);
  localStorage.setItem('sensus-level', state.level);
  localStorage.setItem('sensus-api-key', state.apiKey);

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
      renderWorkspaceEmptyState();
    });
  });

  // Global window click to dismiss modal
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
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
    <div class="workspace-empty-state">
      <h3 class="editorial-heading">${modeName}</h3>
      <p class="editorial-body">${modeDesc}</p>
      <button id="btn-generate-content" class="btn-primary">Generate ${modeName}</button>
    </div>
  `;

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
  renderSpinner(`Drafting your custom ${state.currentMode} exercise...`);
  try {
    const res = await apiRequest('api/generate', {
      mode: state.currentMode,
      level: state.level,
      languagePair: state.languagePair,
      partnerA: state.partnerA,
      partnerB: state.partnerB
    });

    if (res.success && res.data) {
      if (state.currentMode === 'story') renderStoryExercise(res.data);
      else if (state.currentMode === 'vocabulary') renderVocabularyExercise(res.data);
      else if (state.currentMode === 'listening') renderListeningExercise(res.data);
      else if (state.currentMode === 'reading') renderReadingExercise(res.data);
      else if (state.currentMode === 'conversation') renderConversationExercise(res.data);
    } else {
      renderError("Could not retrieve exercise details from Gemini.");
    }
  } catch (err) {
    renderError(err.message);
  }
}

// ----------------------------------------------------
// 7. SPECIFIC EXERCISE RENDERERS
// ----------------------------------------------------

// Mode A: PIMSLEUR STORY RENDERER
function renderStoryExercise(data) {
  const container = document.getElementById('study-workspace');
  let dialogueHTML = '';
  
  data.dialogue.forEach((line, index) => {
    const isPartnerA = index % 2 === 0;
    const speakerClass = isPartnerA ? 'bubble-partner-a' : 'bubble-partner-b';
    const speakerName = line.speaker || (isPartnerA ? state.partnerA : state.partnerB);
    
    dialogueHTML += `
      <div class="dialogue-bubble ${speakerClass}">
        <span class="speaker-label">${speakerName} (${isPartnerA ? 'Partner A' : 'Partner B'})</span>
        <div class="text-target">${line.text}</div>
        <div class="text-translation" style="display: none;">${line.translation}</div>
        <button class="btn-tts" onclick="speak('${line.text.replace(/'/g, "\\'")}')" style="margin-top: 0.5rem; padding: 0.2rem 0.6rem; font-size: 0.75rem;">
          🔊 Play audio
        </button>
      </div>
    `;
  });

  let questionsHTML = '';
  data.comprehension.forEach((q, qIndex) => {
    let optionsHTML = '';
    q.options.forEach((opt, oIndex) => {
      optionsHTML += `
        <button class="option-card" data-qindex="${qIndex}" data-oindex="${oIndex}">
          <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
          <div>${opt}</div>
        </button>
      `;
    });

    questionsHTML += `
      <div class="quiz-question-box" id="q-box-${qIndex}" style="margin-top: 2rem; display: ${qIndex === 0 ? 'block' : 'none'};">
        <h4 style="font-family: Outfit; font-size: 1.1rem; margin-bottom: 0.5rem;">Question ${qIndex + 1} of 3</h4>
        <p style="font-family: Lora; font-size: 1.15rem; font-style: italic;">${q.question}</p>
        <div class="quiz-options-list">${optionsHTML}</div>
        <div class="feedback-panel feedback-neutral" id="q-feedback-${qIndex}" style="display: none;">
          <div class="feedback-title" id="q-feedback-title-${qIndex}">Correct!</div>
          <div class="feedback-text" id="q-feedback-text-${qIndex}"></div>
          <div class="explanation-text">${q.explanation}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">${data.title}</h3>
        <div class="content-subtitle">Pimsleur Dialogue & Comprehension</div>
      </div>
      <span class="tag tag-slate">${state.level}</span>
    </div>
    
    <div class="exercise-container">
      <div class="hero-gradient-card dawn">
        <div class="hero-content">
          <h3>Scenario context</h3>
          <p>${data.scenario}</p>
        </div>
      </div>

      <div class="translation-toggle-bar">
        <button id="btn-toggle-translations" class="btn-secondary">Show Translations</button>
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
          <button id="btn-prev-q" class="btn-secondary" style="visibility: hidden;">Previous Question</button>
          <button id="btn-next-q" class="btn-primary" style="display: none;">Next Question</button>
          <button id="btn-finish-story" class="btn-primary" style="display: none;">Log Session</button>
        </div>
      </div>
    </div>
  `;

  // Attach handlers
  let activeQuestionIndex = 0;
  const totalQuestions = data.comprehension.length;
  let correctCount = 0;

  // Toggle Translations
  const transBtn = document.getElementById('btn-toggle-translations');
  transBtn.addEventListener('click', () => {
    const translations = document.querySelectorAll('.text-translation');
    const isShowing = translations[0].style.display !== 'none';
    translations.forEach(el => el.style.display = isShowing ? 'none' : 'block');
    transBtn.textContent = isShowing ? 'Show Translations' : 'Hide Translations';
  });

  // Handle option click
  const optionCards = container.querySelectorAll('.option-card');
  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      const qIndex = parseInt(card.dataset.qindex);
      const oIndex = parseInt(card.dataset.oindex);
      const correctIdx = data.comprehension[qIndex].answerIndex;
      
      // Prevent clicking again once answered
      const siblings = container.querySelectorAll(`.option-card[data-qindex="${qIndex}"]`);
      let alreadyAnswered = false;
      siblings.forEach(s => {
        if (s.classList.contains('correct') || s.classList.contains('incorrect')) {
          alreadyAnswered = true;
        }
      });
      if (alreadyAnswered) return;

      const feedbackBox = document.getElementById(`q-feedback-${qIndex}`);
      const feedbackTitle = document.getElementById(`q-feedback-title-${qIndex}`);
      feedbackBox.style.display = 'block';

      if (oIndex === correctIdx) {
        card.classList.add('correct');
        feedbackBox.className = "feedback-panel feedback-success";
        feedbackTitle.textContent = "Correct Reflection";
        correctCount++;
      } else {
        card.classList.add('incorrect');
        // Highlight correct option
        siblings[correctIdx].classList.add('correct');
        feedbackBox.className = "feedback-panel feedback-error";
        feedbackTitle.textContent = "Incorrect Interpretation";
      }

      // Show navigation buttons
      if (activeQuestionIndex < totalQuestions - 1) {
        document.getElementById('btn-next-q').style.display = 'inline-flex';
      } else {
        document.getElementById('btn-finish-story').style.display = 'inline-flex';
      }
    });
  });

  // Next / Prev actions
  const nextBtn = document.getElementById('btn-next-q');
  const prevBtn = document.getElementById('btn-prev-q');
  const finishBtn = document.getElementById('btn-finish-story');

  nextBtn.addEventListener('click', () => {
    document.getElementById(`q-box-${activeQuestionIndex}`).style.display = 'none';
    activeQuestionIndex++;
    document.getElementById(`q-box-${activeQuestionIndex}`).style.display = 'block';
    
    prevBtn.style.visibility = 'visible';
    nextBtn.style.display = 'none';
  });

  prevBtn.addEventListener('click', () => {
    document.getElementById(`q-box-${activeQuestionIndex}`).style.display = 'none';
    activeQuestionIndex--;
    document.getElementById(`q-box-${activeQuestionIndex}`).style.display = 'block';
    
    if (activeQuestionIndex === 0) {
      prevBtn.style.visibility = 'hidden';
    }
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
  });

  finishBtn.addEventListener('click', () => {
    const scoreStr = `${correctCount}/${totalQuestions}`;
    const logRecord = {
      title: data.title,
      mode: 'Pimsleur Story',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`
    };
    saveToHistory(logRecord);
    
    // Switch to status success
    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Dialogue completed and logged</h3>
        <p style="margin-bottom: 2rem;">Congratulations on reading together. You answered ${correctCount} out of 3 questions correctly.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// Mode B: VOCABULARY EXERCISE RENDERER
function renderVocabularyExercise(data) {
  const container = document.getElementById('study-workspace');
  let cardsHTML = '';

  data.questions.forEach((q, qIndex) => {
    let optionsHTML = '';
    q.options.forEach((opt, oIndex) => {
      optionsHTML += `
        <button class="option-card vocab-option" data-qindex="${qIndex}" data-option="${opt}">
          <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
          <div>${opt}</div>
        </button>
      `;
    });

    cardsHTML += `
      <div class="vocab-question-card" id="vocab-card-${qIndex}" style="display: ${qIndex === 0 ? 'block' : 'none'};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; align-items: center;">
          <span class="tag tag-rose">Question ${qIndex + 1} of 5</span>
          <span style="font-size: 0.9rem; color: var(--text-muted); font-family: Outfit;">Term Analysis</span>
        </div>
        
        <h3 style="font-family: Lora; font-size: 1.5rem; font-style: italic; margin-bottom: 1.5rem; text-align: center;">
          "${q.word}"
        </h3>
        
        <p style="text-align: center; margin-bottom: 1.5rem; font-family: Outfit; color: var(--text-muted);">
          Definition / Sense: <strong>${q.definition}</strong>
        </p>

        <div style="background-color: var(--input-bg); padding: 1.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 2rem;">
          <div class="speaker-label" style="margin-bottom: 0.5rem;">In Context</div>
          <div class="text-target" style="font-size: 1.1rem; line-height: 1.6;">${q.sentence}</div>
          <div class="text-translation" style="font-size: 0.95rem; margin-top: 0.5rem; color: var(--text-muted); font-style: italic;">${q.sentenceTranslation}</div>
        </div>

        <div class="quiz-options-list">${optionsHTML}</div>

        <div class="feedback-panel feedback-neutral" id="vocab-feedback-${qIndex}" style="display: none; margin-top: 2rem;">
          <div class="feedback-title" id="vocab-feedback-title-${qIndex}">Evaluation</div>
          <div class="explanation-text">${q.explanation}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">Vocabulary Journal</h3>
        <div class="content-subtitle">Select and fit the correct terms in context</div>
      </div>
      <span class="tag tag-rose">${state.level}</span>
    </div>

    <div class="exercise-container">
      ${cardsHTML}
      
      <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 1.5rem; margin-top: 2.5rem;">
        <button id="btn-vocab-prev" class="btn-secondary" style="visibility: hidden;">Previous</button>
        <button id="btn-vocab-next" class="btn-primary" style="display: none;">Next Term</button>
        <button id="btn-vocab-finish" class="btn-primary" style="display: none;">Save Progress</button>
      </div>
    </div>
  `;

  let activeIndex = 0;
  const totalVocab = data.questions.length;
  let correctCount = 0;

  const optionCards = container.querySelectorAll('.vocab-option');
  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      const qIndex = parseInt(card.dataset.qindex);
      const selectedOpt = card.dataset.option;
      const correctVal = data.questions[qIndex].correctAnswer;

      const siblings = container.querySelectorAll(`.vocab-option[data-qindex="${qIndex}"]`);
      let alreadyAnswered = false;
      siblings.forEach(s => {
        if (s.classList.contains('correct') || s.classList.contains('incorrect')) {
          alreadyAnswered = true;
        }
      });
      if (alreadyAnswered) return;

      const feedbackBox = document.getElementById(`vocab-feedback-${qIndex}`);
      const feedbackTitle = document.getElementById(`vocab-feedback-title-${qIndex}`);
      feedbackBox.style.display = 'block';

      if (selectedOpt === correctVal) {
        card.classList.add('correct');
        feedbackBox.className = "feedback-panel feedback-success";
        feedbackTitle.textContent = "Word matched successfully";
        correctCount++;
      } else {
        card.classList.add('incorrect');
        feedbackBox.className = "feedback-panel feedback-error";
        feedbackTitle.textContent = `Correction Required (Answer: ${correctVal})`;
        
        // highlight correct sibling
        siblings.forEach(s => {
          if (s.dataset.option === correctVal) {
            s.classList.add('correct');
          }
        });
      }

      if (activeIndex < totalVocab - 1) {
        document.getElementById('btn-vocab-next').style.display = 'inline-flex';
      } else {
        document.getElementById('btn-vocab-finish').style.display = 'inline-flex';
      }
    });
  });

  const nextBtn = document.getElementById('btn-vocab-next');
  const prevBtn = document.getElementById('btn-vocab-prev');
  const finishBtn = document.getElementById('btn-vocab-finish');

  nextBtn.addEventListener('click', () => {
    document.getElementById(`vocab-card-${activeIndex}`).style.display = 'none';
    activeIndex++;
    document.getElementById(`vocab-card-${activeIndex}`).style.display = 'block';
    
    prevBtn.style.visibility = 'visible';
    nextBtn.style.display = 'none';
  });

  prevBtn.addEventListener('click', () => {
    document.getElementById(`vocab-card-${activeIndex}`).style.display = 'none';
    activeIndex--;
    document.getElementById(`vocab-card-${activeIndex}`).style.display = 'block';
    
    if (activeIndex === 0) {
      prevBtn.style.visibility = 'hidden';
    }
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
  });

  finishBtn.addEventListener('click', () => {
    const scoreStr = `${correctCount}/${totalVocab}`;
    const logRecord = {
      title: "Vocabulary Journal",
      mode: 'Vocabulary Match',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`
    };
    saveToHistory(logRecord);

    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Vocabulary set completed</h3>
        <p style="margin-bottom: 2rem;">You successfully identified ${correctCount} out of 5 words correctly in context.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// Mode C: LISTENING COMPREHENSION RENDERER
function renderListeningExercise(data) {
  const container = document.getElementById('study-workspace');
  let cardsHTML = '';

  data.exercises.forEach((ex, index) => {
    let optionsHTML = '';
    ex.options.forEach((opt, oIndex) => {
      optionsHTML += `
        <button class="option-card listening-option" data-index="${index}" data-oindex="${oIndex}">
          <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
          <div>${opt}</div>
        </button>
      `;
    });

    cardsHTML += `
      <div class="listening-card" id="listening-card-${index}" style="display: ${index === 0 ? 'block' : 'none'};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
          <span class="tag tag-slate">Audio Passage ${index + 1} of 3</span>
        </div>
        
        <div class="hero-gradient-card deep-water" style="text-align: center;">
          <div class="hero-content" style="margin: 0 auto;">
            <button class="btn-tts" onclick="speak('${ex.audioPhrase.replace(/'/g, "\\'")}')" style="background-color: var(--terracotta); padding: 0.8rem 1.8rem; font-size: 1.1rem; border-radius: var(--radius-md);">
              🔊 Listen to sentence
            </button>
            <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--blush-rose);">Click to play or replay audio phrase</p>
          </div>
        </div>

        <div class="listening-transcription" style="display: none; background-color: var(--input-bg); padding: 1.2rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin: 1.5rem 0;">
          <div class="speaker-label">Transcription</div>
          <div class="text-target">${ex.audioPhrase}</div>
          <div class="text-translation" style="margin-top: 0.4rem;">${ex.translation}</div>
        </div>

        <div class="question-section" style="margin-top: 2rem;">
          <h4 style="font-family: Outfit; font-size: 1.1rem; margin-bottom: 0.8rem;">Question:</h4>
          <p style="font-family: Lora; font-size: 1.15rem; font-style: italic; margin-bottom: 1.5rem;">${ex.question}</p>
          <div class="quiz-options-list">${optionsHTML}</div>
        </div>

        <div class="feedback-panel feedback-neutral" id="listening-feedback-${index}" style="display: none; margin-top: 2rem;">
          <div class="feedback-title" id="listening-feedback-title-${index}">Result</div>
          <div class="explanation-text">${ex.explanation}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">Listening Laboratory</h3>
        <div class="content-subtitle">Listen closely to target language audios and test comprehension</div>
      </div>
      <span class="tag tag-slate">${state.level}</span>
    </div>

    <div class="exercise-container">
      <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
        <button id="btn-toggle-listening-trans" class="btn-secondary">Show Text Transcription</button>
      </div>

      ${cardsHTML}

      <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 1.5rem; margin-top: 2.5rem;">
        <button id="btn-listening-prev" class="btn-secondary" style="visibility: hidden;">Previous</button>
        <button id="btn-listening-next" class="btn-primary" style="display: none;">Next Audio</button>
        <button id="btn-listening-finish" class="btn-primary" style="display: none;">Save to Log</button>
      </div>
    </div>
  `;

  let activeIndex = 0;
  const totalEx = data.exercises.length;
  let correctCount = 0;

  // Toggle Text Transcription
  const transBtn = document.getElementById('btn-toggle-listening-trans');
  transBtn.addEventListener('click', () => {
    const transcriptions = document.querySelectorAll('.listening-transcription');
    const isShowing = transcriptions[0].style.display !== 'none';
    transcriptions.forEach(el => el.style.display = isShowing ? 'none' : 'block');
    transBtn.textContent = isShowing ? 'Show Text Transcription' : 'Hide Text Transcription';
  });

  // Handle option selection
  const options = container.querySelectorAll('.listening-option');
  options.forEach(card => {
    card.addEventListener('click', () => {
      const exIndex = parseInt(card.dataset.index);
      const oIndex = parseInt(card.dataset.oindex);
      const correctIdx = data.exercises[exIndex].answerIndex;

      const siblings = container.querySelectorAll(`.listening-option[data-index="${exIndex}"]`);
      let alreadyAnswered = false;
      siblings.forEach(s => {
        if (s.classList.contains('correct') || s.classList.contains('incorrect')) {
          alreadyAnswered = true;
        }
      });
      if (alreadyAnswered) return;

      const feedbackBox = document.getElementById(`listening-feedback-${exIndex}`);
      const feedbackTitle = document.getElementById(`listening-feedback-title-${exIndex}`);
      feedbackBox.style.display = 'block';

      if (oIndex === correctIdx) {
        card.classList.add('correct');
        feedbackBox.className = "feedback-panel feedback-success";
        feedbackTitle.textContent = "Accurate Listening";
        correctCount++;
      } else {
        card.classList.add('incorrect');
        siblings[correctIdx].classList.add('correct');
        feedbackBox.className = "feedback-panel feedback-error";
        feedbackTitle.textContent = "Misheard Details";
      }

      if (activeIndex < totalEx - 1) {
        document.getElementById('btn-listening-next').style.display = 'inline-flex';
      } else {
        document.getElementById('btn-listening-finish').style.display = 'inline-flex';
      }
    });
  });

  const nextBtn = document.getElementById('btn-listening-next');
  const prevBtn = document.getElementById('btn-listening-prev');
  const finishBtn = document.getElementById('btn-listening-finish');

  nextBtn.addEventListener('click', () => {
    document.getElementById(`listening-card-${activeIndex}`).style.display = 'none';
    activeIndex++;
    document.getElementById(`listening-card-${activeIndex}`).style.display = 'block';
    
    prevBtn.style.visibility = 'visible';
    nextBtn.style.display = 'none';
  });

  prevBtn.addEventListener('click', () => {
    document.getElementById(`listening-card-${activeIndex}`).style.display = 'none';
    activeIndex--;
    document.getElementById(`listening-card-${activeIndex}`).style.display = 'block';
    
    if (activeIndex === 0) {
      prevBtn.style.visibility = 'hidden';
    }
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
  });

  finishBtn.addEventListener('click', () => {
    const scoreStr = `${correctCount}/${totalEx}`;
    const logRecord = {
      title: "Listening Laboratory",
      mode: 'Listening Comprehension',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`
    };
    saveToHistory(logRecord);

    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Listening Session Logged</h3>
        <p style="margin-bottom: 2rem;">You answered ${correctCount} out of 3 listening questions correctly.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// Mode D: READING COMPREHENSION RENDERER
function renderReadingExercise(data) {
  const container = document.getElementById('study-workspace');
  
  // Build vocab notes HTML
  let vocabNotesHTML = '';
  data.vocabularyNotes.forEach(item => {
    vocabNotesHTML += `
      <div class="vocab-item">
        <span class="vocab-term">${item.term}</span>
        <span class="vocab-meaning">${item.meaning}</span>
      </div>
    `;
  });

  // Build questions HTML
  let questionsHTML = '';
  data.questions.forEach((q, qIndex) => {
    let optionsHTML = '';
    q.options.forEach((opt, oIndex) => {
      optionsHTML += `
        <button class="option-card reading-option" data-qindex="${qIndex}" data-oindex="${oIndex}">
          <div class="option-marker">${String.fromCharCode(65 + oIndex)}</div>
          <div>${opt}</div>
        </button>
      `;
    });

    questionsHTML += `
      <div class="reading-q-box" id="reading-q-${qIndex}" style="display: ${qIndex === 0 ? 'block' : 'none'}; margin-top: 2rem;">
        <h4 style="font-family: Outfit; font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--text-muted);">Comprehension Question ${qIndex + 1} of 3</h4>
        <p style="font-family: Lora; font-size: 1.15rem; font-style: italic;">${q.question}</p>
        <div class="quiz-options-list">${optionsHTML}</div>
        
        <div class="feedback-panel feedback-neutral" id="reading-feedback-${qIndex}" style="display: none; margin-top: 1.5rem;">
          <div class="feedback-title" id="reading-feedback-title-${qIndex}">Evaluation</div>
          <div class="explanation-text">${q.explanation}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">Philosophical Reading Journal</h3>
        <div class="content-subtitle">Editorial Reflection Analysis</div>
      </div>
      <span class="tag tag-sage">${state.level}</span>
    </div>

    <div class="exercise-container" style="max-width: 800px; margin: 0 auto;">
      
      <div class="hero-gradient-card mediterranean" style="padding: 1.5rem 2rem; margin-bottom: 2rem;">
        <div class="hero-content">
          <h4 style="font-family: Outfit; font-weight: 500; font-size: 1rem;">${data.title}</h4>
        </div>
      </div>

      <article class="reading-passage">
        ${data.passage}
      </article>

      <div class="translation-toggle-bar">
        <button id="btn-toggle-reading-trans" class="btn-secondary">Show Text Translation</button>
      </div>

      <div id="reading-translation-box" style="display: none; background-color: var(--input-bg); border-left: 3px solid var(--blush-rose); padding: 1.5rem; border-radius: var(--radius-sm); margin-bottom: 2rem; font-style: italic; font-size: 1rem;">
        ${data.translation}
      </div>

      <div class="reading-vocab-notes">
        <div class="reading-vocab-title">Glossary & Nuance Notes</div>
        <div class="vocab-grid">
          ${vocabNotesHTML}
        </div>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 2rem; margin-top: 3rem;">
        <h3 style="font-family: Outfit; margin-bottom: 1.5rem; text-align: center;">Reflective Inquiries</h3>
        
        ${questionsHTML}

        <div style="display: flex; justify-content: space-between; margin-top: 2rem;">
          <button id="btn-reading-prev" class="btn-secondary" style="visibility: hidden;">Previous</button>
          <button id="btn-reading-next" class="btn-primary" style="display: none;">Next Inquiry</button>
          <button id="btn-reading-finish" class="btn-primary" style="display: none;">Conclude Session</button>
        </div>
      </div>

    </div>
  `;

  let activeIndex = 0;
  const totalQ = data.questions.length;
  let correctCount = 0;

  // Toggle translations
  const transBtn = document.getElementById('btn-toggle-reading-trans');
  transBtn.addEventListener('click', () => {
    const box = document.getElementById('reading-translation-box');
    const isShowing = box.style.display !== 'none';
    box.style.display = isShowing ? 'none' : 'block';
    transBtn.textContent = isShowing ? 'Show Text Translation' : 'Hide Text Translation';
  });

  // Handle options
  const optionCards = container.querySelectorAll('.reading-option');
  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      const qIndex = parseInt(card.dataset.qindex);
      const oIndex = parseInt(card.dataset.oindex);
      const correctIdx = data.questions[qIndex].answerIndex;

      const siblings = container.querySelectorAll(`.reading-option[data-qindex="${qIndex}"]`);
      let alreadyAnswered = false;
      siblings.forEach(s => {
        if (s.classList.contains('correct') || s.classList.contains('incorrect')) {
          alreadyAnswered = true;
        }
      });
      if (alreadyAnswered) return;

      const feedbackBox = document.getElementById(`reading-feedback-${qIndex}`);
      const feedbackTitle = document.getElementById(`reading-feedback-title-${qIndex}`);
      feedbackBox.style.display = 'block';

      if (oIndex === correctIdx) {
        card.classList.add('correct');
        feedbackBox.className = "feedback-panel feedback-success";
        feedbackTitle.textContent = "Correct Interpretation";
        correctCount++;
      } else {
        card.classList.add('incorrect');
        siblings[correctIdx].classList.add('correct');
        feedbackBox.className = "feedback-panel feedback-error";
        feedbackTitle.textContent = "Misinterpretation Corrected";
      }

      if (activeIndex < totalQ - 1) {
        document.getElementById('btn-reading-next').style.display = 'inline-flex';
      } else {
        document.getElementById('btn-reading-finish').style.display = 'inline-flex';
      }
    });
  });

  const nextBtn = document.getElementById('btn-reading-next');
  const prevBtn = document.getElementById('btn-reading-prev');
  const finishBtn = document.getElementById('btn-reading-finish');

  nextBtn.addEventListener('click', () => {
    document.getElementById(`reading-q-${activeIndex}`).style.display = 'none';
    activeIndex++;
    document.getElementById(`reading-q-${activeIndex}`).style.display = 'block';
    
    prevBtn.style.visibility = 'visible';
    nextBtn.style.display = 'none';
  });

  prevBtn.addEventListener('click', () => {
    document.getElementById(`reading-q-${activeIndex}`).style.display = 'none';
    activeIndex--;
    document.getElementById(`reading-q-${activeIndex}`).style.display = 'block';
    
    if (activeIndex === 0) {
      prevBtn.style.visibility = 'hidden';
    }
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
  });

  finishBtn.addEventListener('click', () => {
    const scoreStr = `${correctCount}/${totalQ}`;
    const logRecord = {
      title: data.title,
      mode: 'Reading Passage',
      level: state.level,
      languagePair: state.languagePair,
      score: scoreStr,
      partners: `${state.partnerA} & ${state.partnerB}`
    };
    saveToHistory(logRecord);

    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Reading Session Completed</h3>
        <p style="margin-bottom: 2rem;">Your reflection journal entry has been registered successfully. You answered ${correctCount} out of 3 comprehension inquiries correctly.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

// Mode E: CONVERSATION PRACTICE RENDERER
function renderConversationExercise(data) {
  const container = document.getElementById('study-workspace');
  
  let helperHTML = '';
  data.helperVocabulary.forEach(item => {
    helperHTML += `<li><strong>${item.phrase}</strong> — <em>${item.translation}</em></li>`;
  });

  let starterHTML = '';
  data.starterPhrases.forEach(phrase => {
    starterHTML += `<li style="margin-bottom: 0.4rem; font-style: italic; color: var(--text-muted); cursor: pointer;" onclick="document.activeElement.value = (document.activeElement.value || '') + '${phrase.replace(/'/g, "\\'")}'">${phrase}</li>`;
  });

  container.innerHTML = `
    <div class="content-header">
      <div>
        <h3 class="content-title">Conversation Lab</h3>
        <div class="content-subtitle">Interact dynamically and write your thoughts</div>
      </div>
      <span class="tag tag-rose">${state.level}</span>
    </div>

    <div class="exercise-container">
      <div class="hero-gradient-card solstice">
        <div class="hero-content">
          <h3>Active Topic: ${data.topic}</h3>
          <p>${data.scenario}</p>
        </div>
      </div>

      <div class="conversation-exercise">
        <!-- Partner A Lane -->
        <div class="partner-lane" id="lane-partner-a">
          <h4 class="partner-lane-title">${state.partnerA} (Partner A)</h4>
          <p class="partner-lane-prompt">${data.partnerAPrompt}</p>
          
          <textarea id="response-partner-a" class="textarea-response" placeholder="Draft your response in target language..."></textarea>
          
          <button id="btn-evaluate-a" class="btn-primary" style="margin-top: auto;">Submit response for AI Audit</button>
          
          <div class="feedback-panel" id="eval-feedback-a" style="display: none; margin-top: 1.5rem;">
            <div class="feedback-title" id="eval-title-a">AI Correction</div>
            <p class="feedback-text" id="eval-text-a"></p>
            <div class="explanation-text" id="eval-sugg-a"></div>
          </div>
        </div>

        <!-- Partner B Lane -->
        <div class="partner-lane" id="lane-partner-b">
          <h4 class="partner-lane-title">${state.partnerB} (Partner B)</h4>
          <p class="partner-lane-prompt">${data.partnerBPrompt}</p>
          
          <textarea id="response-partner-b" class="textarea-response" placeholder="Respond to Partner A in target language..."></textarea>
          
          <button id="btn-evaluate-b" class="btn-primary" style="margin-top: auto;">Submit response for AI Audit</button>
          
          <div class="feedback-panel" id="eval-feedback-b" style="display: none; margin-top: 1.5rem;">
            <div class="feedback-title" id="eval-title-b">AI Correction</div>
            <p class="feedback-text" id="eval-text-b"></p>
            <div class="explanation-text" id="eval-sugg-b"></div>
          </div>
        </div>
      </div>

      <div class="form-row" style="margin-top: 2rem;">
        <div class="helper-phrases-box">
          <div class="helper-phrases-title">Vocabulary & Helpers</div>
          <ul class="helper-list">
            ${helperHTML}
          </ul>
        </div>
        <div class="helper-phrases-box">
          <div class="helper-phrases-title">Sentence Openings (Click to append)</div>
          <ul class="helper-list">
            ${starterHTML}
          </ul>
        </div>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 2rem; text-align: center; margin-top: 2rem;">
        <button id="btn-conclude-conversation" class="btn-secondary" style="padding: 0.8rem 2.5rem;">Conclude & Write Session to Journal</button>
      </div>
    </div>
  `;

  // Evaluation button event listeners
  setupLaneEvaluation('a', data.partnerAPrompt);
  setupLaneEvaluation('b', data.partnerBPrompt);

  document.getElementById('btn-conclude-conversation').addEventListener('click', () => {
    const textA = document.getElementById('response-partner-a').value.trim();
    const textB = document.getElementById('response-partner-b').value.trim();
    
    if (!textA && !textB) {
      alert("At least one partner must draft a response before concluding.");
      return;
    }

    const logRecord = {
      title: `Conversation: ${data.topic}`,
      mode: 'Active Conversation',
      level: state.level,
      languagePair: state.languagePair,
      score: "Evaluated",
      partners: `${state.partnerA} & ${state.partnerB}`
    };
    saveToHistory(logRecord);

    container.innerHTML = `
      <div class="success-banner" style="margin-top: 2rem; text-align: center; padding: 3rem;">
        <h3 class="editorial-heading">Conversation Journal Saved</h3>
        <p style="margin-bottom: 2rem;">Both submissions have been logged. Keep conversing and sharing active insights.</p>
        <button onclick="renderWorkspaceEmptyState()" class="btn-primary">Return to study workspace</button>
      </div>
    `;
  });
}

function setupLaneEvaluation(laneKey, promptText) {
  const btn = document.getElementById(`btn-evaluate-${laneKey}`);
  const textarea = document.getElementById(`response-partner-${laneKey}`);
  const feedbackBox = document.getElementById(`eval-feedback-${laneKey}`);
  const feedbackTitle = document.getElementById(`eval-title-${laneKey}`);
  const feedbackText = document.getElementById(`eval-text-${laneKey}`);
  const suggestionsBox = document.getElementById(`eval-sugg-${laneKey}`);

  btn.addEventListener('click', async () => {
    const userText = textarea.value.trim();
    if (!userText) {
      alert("Please write a response before requesting evaluation.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Auditing response...";

    try {
      const res = await apiRequest('api/evaluate', {
        prompt: promptText,
        partnerResponse: userText,
        partnerName: laneKey === 'a' ? state.partnerA : state.partnerB,
        languagePair: state.languagePair,
        level: state.level
      });

      btn.disabled = false;
      btn.textContent = "Submit response for AI Audit";

      if (res.success && res.data) {
        const evalData = res.data;
        feedbackBox.style.display = 'block';

        if (evalData.isCorrect) {
          feedbackBox.className = "feedback-panel feedback-success";
          feedbackTitle.textContent = "Coherent response";
        } else {
          feedbackBox.className = "feedback-panel feedback-error";
          feedbackTitle.textContent = "Revisions Recommended";
        }

        feedbackText.innerHTML = `
          <strong>Corrected structure:</strong> <br>
          <span style="font-size: 1.1rem; color: var(--terracotta);">${evalData.correctedText}</span><br><br>
          <strong>Grammar feedback:</strong> <br>
          ${evalData.feedback}
        `;

        let suggestionsHTML = '<strong>Alternative structures & suggestions:</strong><ul>';
        evalData.suggestions.forEach(s => {
          suggestionsHTML += `<li>${s}</li>`;
        });
        suggestionsHTML += '</ul>';
        suggestionsBox.innerHTML = suggestionsHTML;

      } else {
        alert("Evaluation failed. Could not parse AI correction.");
      }
    } catch(err) {
      btn.disabled = false;
      btn.textContent = "Submit response for AI Audit";
      alert(err.message);
    }
  });
}

// ----------------------------------------------------
// 8. RENDER HISTORY LIST
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
      <div class="history-item">
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
