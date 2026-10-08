/**
 * TOUCHCALL // FRONTEND CLIENT ENGINE
 * Sovereign Local AI Interface & Landing Page
 * Connects to llama.cpp (Qwen 2.5 3B), Piper TTS, and Faster-Whisper
 */

// ==========================================
// STATE MANAGEMENT
// ==========================================

const state = {
  activeView: 'landing', // 'landing', 'chat', or 'voice'
  conversationHistory: [],
  isGenerating: false,
  isRecording: false,
  isVoiceCallActive: false,
  callState: 'STANDBY', // 'STANDBY', 'LISTENING', 'THINKING', 'SPEAKING'
  voicePlaybackEnabled: true,
  mediaRecorder: null,
  audioChunks: [],
  audioContext: null,
  analyser: null,
  systemPresets: {
    touchcall: `You are TouchCall, a friendly sovereign AI voice assistant. Your purpose is to help the user spend more time outdoors and less time staring at screens. Keep responses very short, natural, friendly, and suitable for being spoken aloud. Do not give long explanations. Do not use markdown or emojis.`,
    coder: `You are an elite systems architect and senior programmer. Deliver precise, production-grade code with rigorous explanations, algorithmic efficiency, and optimal hardware utilization.`,
    general: `You are TouchCall Core, a sovereign offline AI assistant running directly on local silicon. Provide clear, comprehensive, and objective analysis across all domains.`,
    custom: `You are a helpful local AI assistant.`
  },
  currentPreset: 'touchcall',
  hyperparams: {
    temperature: 0.7,
    max_tokens: 512,
    top_p: 0.95
  }
};

// ==========================================
// DOM ELEMENTS
// ==========================================

const DOM = {
  // Views
  landingView: document.getElementById('landingView'),
  chatView: document.getElementById('chatView'),
  voiceView: document.getElementById('voiceView'),
  
  // Navigation Tabs
  tabLandingBtn: document.getElementById('tabLandingBtn'),
  tabChatBtn: document.getElementById('tabChatBtn'),
  tabVoiceBtn: document.getElementById('tabVoiceBtn'),
  brandLogoBtn: document.getElementById('brandLogoBtn'),
  
  // Header Telemetry
  modelPill: document.getElementById('modelPill'),
  ttftPill: document.getElementById('ttftPill'),
  backendTag: document.getElementById('backendTag'),
  tpsTag: document.getElementById('tpsTag'),
  latencyTag: document.getElementById('latencyTag'),
  hudRam: document.getElementById('hudRam'),
  
  // Landing Page Interactive Elements
  ambientHeroCanvas: document.getElementById('ambientHeroCanvas'),
  heroDockWaveCanvas: document.getElementById('heroDockWaveCanvas'),
  heroDirectPromptInput: document.getElementById('heroDirectPromptInput'),
  heroLaunchBtn: document.getElementById('heroLaunchBtn'),
  heroOpenVoiceBtn: document.getElementById('heroOpenVoiceBtn'),
  heroOpenBrandBtn: document.getElementById('heroOpenBrandBtn'),
  landingTestPiperBtn: document.getElementById('landingTestPiperBtn'),
  landingLaunchCallBtn: document.getElementById('landingLaunchCallBtn'),
  landingKnobWheel: document.getElementById('landingKnobWheel'),
  manifestoTerminalBtn: document.getElementById('manifestoTerminalBtn'),
  footerBrandKitBtn: document.getElementById('footerBrandKitBtn'),
  footerTerminalBtn: document.getElementById('footerTerminalBtn'),
  footerVoiceBtn: document.getElementById('footerVoiceBtn'),
  
  // Chat Terminal
  messagesContainer: document.getElementById('messagesContainer'),
  welcomeHero: document.getElementById('welcomeHero'),
  promptInput: document.getElementById('promptInput'),
  sendBtn: document.getElementById('sendBtn'),
  micBtn: document.getElementById('micBtn'),
  voiceWavePreview: document.getElementById('voiceWavePreview'),
  piperAudioPlayer: document.getElementById('piperAudioPlayer'),
  
  // Sidebar
  sidebarPanel: document.getElementById('sidebarPanel'),
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  presetBadges: document.querySelectorAll('.preset-badge'),
  customSystemPromptInput: document.getElementById('customSystemPromptInput'),
  tempSlider: document.getElementById('tempSlider'),
  tempVal: document.getElementById('tempVal'),
  maxTokensSlider: document.getElementById('maxTokensSlider'),
  maxTokensVal: document.getElementById('maxTokensVal'),
  topPSlider: document.getElementById('topPSlider'),
  topPVal: document.getElementById('topPVal'),
  ramStat: document.getElementById('ramStat'),
  ramProgress: document.getElementById('ramProgress'),
  cpuStat: document.getElementById('cpuStat'),
  cpuProgress: document.getElementById('cpuProgress'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  
  // Voice Call Stage
  callStateLabel: document.getElementById('callStateLabel'),
  voiceCallCanvas: document.getElementById('voiceCallCanvas'),
  voiceSubtitleText: document.getElementById('voiceSubtitleText'),
  voiceCallOrbBtn: document.getElementById('voiceCallOrbBtn'),
  voiceCallCaption: document.getElementById('voiceCallCaption'),
  ttsVoiceToggleBtn: document.getElementById('ttsVoiceToggleBtn'),
  rotaryKnob: document.getElementById('rotaryKnob'),
  
  // Brand Kit Modal
  brandModal: document.getElementById('brandModal'),
  openBrandModalBtn: document.getElementById('openBrandModalBtn'),
  closeBrandModalBtn: document.getElementById('closeBrandModalBtn'),
  brandBoardImg: document.getElementById('brandBoardImg'),
  brandCaptionBar: document.getElementById('brandCaptionBar'),
  btnShowLaunchBoard: document.getElementById('btnShowLaunchBoard'),
  btnShow3x3Board: document.getElementById('btnShow3x3Board')
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  initSliders();
  initCustomPrompt();
  fetchTelemetry();
  setInterval(fetchTelemetry, 4000);
  
  // Initialize Visual Animations
  initAmbientHeroCanvas();
  initHeroDockWaveform();
  initLandingKnobPhysics();
  initVoiceCanvasDrawers();
});

function initEventListeners() {
  // Navigation Tabs & View Routing
  if (DOM.tabLandingBtn) DOM.tabLandingBtn.addEventListener('click', () => switchView('landing'));
  if (DOM.tabChatBtn) DOM.tabChatBtn.addEventListener('click', () => switchView('chat'));
  if (DOM.tabVoiceBtn) DOM.tabVoiceBtn.addEventListener('click', () => switchView('voice'));
  if (DOM.brandLogoBtn) DOM.brandLogoBtn.addEventListener('click', () => switchView('landing'));

  // Landing Page Interactive Triggers
  if (DOM.heroLaunchBtn) {
    DOM.heroLaunchBtn.addEventListener('click', () => {
      const prompt = DOM.heroDirectPromptInput ? DOM.heroDirectPromptInput.value.trim() : '';
      switchView('chat');
      if (prompt) {
        DOM.promptInput.value = prompt;
        handleUserSubmit();
      }
    });
  }

  if (DOM.heroDirectPromptInput) {
    DOM.heroDirectPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        DOM.heroLaunchBtn.click();
      }
    });
  }

  if (DOM.heroOpenVoiceBtn) DOM.heroOpenVoiceBtn.addEventListener('click', () => switchView('voice'));
  if (DOM.heroOpenBrandBtn) DOM.heroOpenBrandBtn.addEventListener('click', () => openBrandModal());
  if (DOM.landingLaunchCallBtn) DOM.landingLaunchCallBtn.addEventListener('click', () => switchView('voice'));
  if (DOM.manifestoTerminalBtn) DOM.manifestoTerminalBtn.addEventListener('click', () => switchView('chat'));
  
  if (DOM.footerBrandKitBtn) DOM.footerBrandKitBtn.addEventListener('click', () => openBrandModal());
  if (DOM.footerTerminalBtn) DOM.footerTerminalBtn.addEventListener('click', () => switchView('chat'));
  if (DOM.footerVoiceBtn) DOM.footerVoiceBtn.addEventListener('click', () => switchView('voice'));

  // Inline Piper Speech Test
  if (DOM.landingTestPiperBtn) {
    DOM.landingTestPiperBtn.addEventListener('click', () => {
      const sampleText = "TouchCall local intelligence is online. Executing neural inference directly on personal silicon.";
      synthesizeAndPlay(sampleText);
    });
  }

  // Prompt Send & Input Auto-grow
  DOM.sendBtn.addEventListener('click', handleUserSubmit);
  DOM.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserSubmit();
    }
  });

  DOM.promptInput.addEventListener('input', () => {
    DOM.promptInput.style.height = 'auto';
    DOM.promptInput.style.height = Math.min(DOM.promptInput.scrollHeight, 180) + 'px';
  });

  // Quick Prompt Chips in Chat Hero
  document.querySelectorAll('.prompt-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      if (prompt) {
        DOM.promptInput.value = prompt;
        handleUserSubmit();
      }
    });
  });

  // Microphone / Whisper STT
  DOM.micBtn.addEventListener('click', toggleAudioRecording);
  if (DOM.voiceWavePreview) DOM.voiceWavePreview.addEventListener('click', stopAudioRecording);

  // Sidebar Controls
  DOM.toggleSidebarBtn.addEventListener('click', () => {
    DOM.sidebarPanel.classList.toggle('open');
  });
  DOM.closeSidebarBtn.addEventListener('click', () => {
    DOM.sidebarPanel.classList.remove('open');
  });

  // Presets
  DOM.presetBadges.forEach(badge => {
    badge.addEventListener('click', () => {
      DOM.presetBadges.forEach(b => b.classList.remove('active'));
      badge.classList.add('active');
      const presetKey = badge.getAttribute('data-preset');
      state.currentPreset = presetKey;
      DOM.customSystemPromptInput.value = state.systemPresets[presetKey] || '';
    });
  });

  DOM.clearChatBtn.addEventListener('click', clearConversation);

  // Brand Kit Modal & Deck Switcher
  DOM.openBrandModalBtn.addEventListener('click', openBrandModal);
  DOM.closeBrandModalBtn.addEventListener('click', () => DOM.brandModal.style.display = 'none');
  DOM.brandModal.addEventListener('click', (e) => {
    if (e.target === DOM.brandModal) DOM.brandModal.style.display = 'none';
  });

  if (DOM.btnShowLaunchBoard) {
    DOM.btnShowLaunchBoard.addEventListener('click', () => {
      DOM.btnShowLaunchBoard.classList.add('active');
      DOM.btnShow3x3Board.classList.remove('active');
      DOM.brandBoardImg.src = '/static/assets/touchcall_launch_board.jpg';
      DOM.brandCaptionBar.innerText = 'TOUCHCALL 2×3 CAMPAIGN LAUNCH DECK · SWISS CAD SPECIFICATION · CARBON VOID CANVAS';
    });
  }

  if (DOM.btnShow3x3Board) {
    DOM.btnShow3x3Board.addEventListener('click', () => {
      DOM.btnShow3x3Board.classList.add('active');
      DOM.btnShowLaunchBoard.classList.remove('active');
      DOM.brandBoardImg.src = '/static/assets/touchcall_brand_kit.jpg';
      DOM.brandCaptionBar.innerText = 'TOUCHCALL 3×3 IDENTITY BOARD · SWISS GRID SYSTEM · ARCHITECTURAL CANVAS';
    });
  }

  // Color Swatch Copy Action
  document.querySelectorAll('.swatch-card').forEach(card => {
    card.addEventListener('click', () => {
      const hex = card.getAttribute('data-copy');
      if (hex) {
        navigator.clipboard.writeText(hex).then(() => {
          const nameEl = card.querySelector('.swatch-name');
          const orig = nameEl.innerText;
          nameEl.innerText = 'COPIED!';
          setTimeout(() => nameEl.innerText = orig, 1200);
        });
      }
    });
  });

  // Voice Call Stage Events
  DOM.voiceCallOrbBtn.addEventListener('click', handleVoiceCallOrbClick);
  DOM.ttsVoiceToggleBtn.addEventListener('click', () => {
    state.voicePlaybackEnabled = !state.voicePlaybackEnabled;
    DOM.ttsVoiceToggleBtn.style.opacity = state.voicePlaybackEnabled ? '1' : '0.4';
  });

  // Rotary Knob Drag Rotation on Voice Deck
  initRotaryKnobPhysics();
}

function openBrandModal() {
  DOM.brandModal.style.display = 'flex';
}

function switchView(viewName) {
  state.activeView = viewName;

  // Toggle View Panels
  if (DOM.landingView) DOM.landingView.classList.toggle('active', viewName === 'landing');
  if (DOM.chatView) DOM.chatView.classList.toggle('active', viewName === 'chat');
  if (DOM.voiceView) DOM.voiceView.classList.toggle('active', viewName === 'voice');

  // Toggle Navigation Segmented Control
  if (DOM.tabLandingBtn) DOM.tabLandingBtn.classList.toggle('active', viewName === 'landing');
  if (DOM.tabChatBtn) DOM.tabChatBtn.classList.toggle('active', viewName === 'chat');
  if (DOM.tabVoiceBtn) DOM.tabVoiceBtn.classList.toggle('active', viewName === 'voice');

  if (viewName === 'chat') {
    setTimeout(() => DOM.promptInput.focus(), 150);
  }
}

// ==========================================
// CONFIG & HYPERPARAMETERS
// ==========================================

function initSliders() {
  DOM.tempSlider.addEventListener('input', (e) => {
    state.hyperparams.temperature = parseFloat(e.target.value);
    DOM.tempVal.innerText = e.target.value;
  });
  DOM.maxTokensSlider.addEventListener('input', (e) => {
    state.hyperparams.max_tokens = parseInt(e.target.value, 10);
    DOM.maxTokensVal.innerText = e.target.value;
  });
  DOM.topPSlider.addEventListener('input', (e) => {
    state.hyperparams.top_p = parseFloat(e.target.value);
    DOM.topPVal.innerText = e.target.value;
  });
}

function initCustomPrompt() {
  DOM.customSystemPromptInput.value = state.systemPresets[state.currentPreset];
  DOM.customSystemPromptInput.addEventListener('input', (e) => {
    state.systemPresets.custom = e.target.value;
  });
}

function clearConversation() {
  state.conversationHistory = [];
  DOM.messagesContainer.innerHTML = '';
  if (DOM.welcomeHero) DOM.messagesContainer.appendChild(DOM.welcomeHero);
  DOM.sidebarPanel.classList.remove('open');
}

// ==========================================
// TELEMETRY ENGINE
// ==========================================

async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    if (!res.ok) return;
    const data = await res.json();
    
    // Update Hardware gauges
    const ramText = `${data.memory_used_gb} GB / ${data.memory_total_gb} GB`;
    DOM.ramStat.innerText = ramText;
    if (DOM.hudRam) DOM.hudRam.innerText = ramText;

    const ramPct = Math.round((data.memory_used_gb / data.memory_total_gb) * 100);
    DOM.ramProgress.style.width = `${ramPct}%`;

    DOM.cpuStat.innerText = `${Math.round(data.cpu_usage_pct)}%`;
    DOM.cpuProgress.style.width = `${Math.round(data.cpu_usage_pct)}%`;

    if (data.server_active) {
      DOM.backendTag.innerText = 'llama-server (SSE)';
    } else {
      DOM.backendTag.innerText = 'llama-completion CLI';
    }
  } catch (err) {
    console.debug('Telemetry poll error:', err);
  }
}

// ==========================================
// CHAT INFERENCE & STREAMING
// ==========================================

async function handleUserSubmit() {
  if (state.isGenerating) return;
  const prompt = DOM.promptInput.value.trim();
  if (!prompt) return;

  // Clear input
  DOM.promptInput.value = '';
  DOM.promptInput.style.height = 'auto';

  // Hide welcome hero on first message
  if (DOM.welcomeHero && DOM.welcomeHero.parentNode) {
    DOM.welcomeHero.remove();
  }

  // Append User Message to UI & State
  appendMessage('user', prompt);
  state.conversationHistory.push({ role: 'user', content: prompt });

  // Prepare Assistant Message Card with placeholder
  const assistantCard = appendMessage('assistant', '', true);
  state.isGenerating = true;
  DOM.sendBtn.disabled = true;

  const startTime = performance.now();
  let accumulatedText = '';
  let tokenCount = 0;
  let firstTokenTime = null;

  try {
    const systemPrompt = DOM.customSystemPromptInput.value || state.systemPresets[state.currentPreset];
    const payload = {
      messages: state.conversationHistory,
      system_prompt: systemPrompt,
      temperature: state.hyperparams.temperature,
      max_tokens: state.hyperparams.max_tokens,
      top_p: state.hyperparams.top_p,
      stream: true
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Inference HTTP ${response.status}`);
    }

    // Read SSE Stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Keep last incomplete segment

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.token) {
            if (!firstTokenTime) {
              firstTokenTime = performance.now();
              const ttft = Math.round(firstTokenTime - startTime);
              DOM.ttftPill.innerText = `${ttft}ms TTFT`;
              DOM.latencyTag.innerText = `${ttft}ms`;
            }
            tokenCount++;
            accumulatedText += parsed.token;
            renderAssistantContent(assistantCard, accumulatedText, false);
          }

          if (parsed.done && parsed.metrics) {
            const m = parsed.metrics;
            DOM.tpsTag.innerText = `${m.tps} tok/s`;
            renderAssistantMetrics(assistantCard, m);
          }
        } catch (err) {
          console.debug('SSE parse chunk error:', err);
        }
      }
    }

    // Finalize assistant response
    renderAssistantContent(assistantCard, accumulatedText, true);
    state.conversationHistory.push({ role: 'assistant', content: accumulatedText });

    // Optional Voice Playback via Piper TTS
    if (state.voicePlaybackEnabled && accumulatedText) {
      synthesizeAndPlay(accumulatedText, assistantCard);
    }

  } catch (err) {
    console.error('Inference error:', err);
    assistantCard.querySelector('.message-body').innerHTML = `<p style="color: #FF5252;">Error communicating with local LLM: ${err.message}</p>`;
  } finally {
    state.isGenerating = false;
    DOM.sendBtn.disabled = false;
    DOM.promptInput.focus();
  }
}

// ==========================================
// UI MESSAGE RENDERING & MARKDOWN
// ==========================================

function appendMessage(role, text, isPending = false) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (role === 'user') {
    row.innerHTML = `
      <div class="message-card">
        <div class="message-meta">
          <span class="meta-sender">YOU</span>
          <span class="meta-time">${timeStr}</span>
        </div>
        <div class="message-body">${escapeHtml(text)}</div>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div class="avatar-badge">
        <svg width="20" height="20" viewBox="0 0 100 80" fill="none">
          <path d="M42 12 H62 V22 H42 Z" fill="#F0F3F6" />
          <path d="M62 12 H82 L72 22 H62 Z" fill="#FF5C00" />
          <path d="M57 22 H67 V68 H57 Z" fill="#F0F3F6" />
        </svg>
      </div>
      <div class="message-card">
        <div class="message-meta">
          <span class="meta-sender">TOUCHCALL</span>
          <span class="meta-time">${timeStr}</span>
        </div>
        <div class="message-body">${isPending ? '<span class="typing-cursor">█</span>' : renderMarkdown(text)}</div>
        <div class="message-actions" style="${isPending ? 'display: none;' : ''}">
          <button class="action-pill-btn speak-btn" title="Speak aloud with Piper">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            <span>Read Aloud</span>
          </button>
          <button class="action-pill-btn copy-btn" title="Copy text">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
          <span class="generation-metrics-tag"></span>
        </div>
      </div>
    `;

    const speakBtn = row.querySelector('.speak-btn');
    const copyBtn = row.querySelector('.copy-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        const rawContent = row.getAttribute('data-raw-content') || text;
        synthesizeAndPlay(rawContent, row);
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const rawContent = row.getAttribute('data-raw-content') || text;
        navigator.clipboard.writeText(rawContent).then(() => {
          const span = copyBtn.querySelector('span');
          span.innerText = 'Copied!';
          setTimeout(() => span.innerText = 'Copy', 1500);
        });
      });
    }
  }

  DOM.messagesContainer.appendChild(row);
  DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
  return row;
}

function renderAssistantContent(card, text, isDone) {
  card.setAttribute('data-raw-content', text);
  const bodyEl = card.querySelector('.message-body');
  if (bodyEl) {
    bodyEl.innerHTML = renderMarkdown(text) + (isDone ? '' : ' <span class="typing-cursor">█</span>');
  }
  if (isDone) {
    const actionsEl = card.querySelector('.message-actions');
    if (actionsEl) actionsEl.style.display = 'flex';
  }
  DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
}

function renderAssistantMetrics(card, m) {
  const tag = card.querySelector('.generation-metrics-tag');
  if (tag) {
    tag.innerText = `${m.tokens} tokens · ${m.tps} tok/s · ${m.duration_sec}s`;
  }
}

function renderMarkdown(raw) {
  if (!raw) return '';
  let text = escapeHtml(raw);

  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = 'code_' + Math.random().toString(36).substring(2, 9);
    return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span>${lang ? lang.toUpperCase() : 'CODE'}</span>
          <button class="copy-code-btn" onclick="copyCodeBlock('${id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
        </div>
        <pre><code id="${id}">${code}</code></pre>
      </div>
    `;
  });

  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const paragraphs = text.split('\n\n').filter(p => p.trim());
  return paragraphs.map(p => {
    if (p.startsWith('<div class="code-block-wrapper">')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

window.copyCodeBlock = function(id) {
  const el = document.getElementById(id);
  if (el) {
    navigator.clipboard.writeText(el.innerText).then(() => {
      const btn = el.closest('.code-block-wrapper').querySelector('.copy-code-btn span');
      if (btn) {
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = 'Copy', 1500);
      }
    });
  }
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// AUDIO SYNTHESIS & PLAYBACK (PIPER TTS)
// ==========================================

async function synthesizeAndPlay(text, cardEl = null) {
  const cleanSpeechText = text
    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
    .replace(/`[^`]+`/g, '')
    .replace(/[*#_~]/g, '')
    .trim();

  if (!cleanSpeechText) return;

  const speakBtn = cardEl ? cardEl.querySelector('.speak-btn') : null;
  if (speakBtn) speakBtn.classList.add('playing');

  try {
    const res = await fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanSpeechText })
    });

    if (!res.ok) throw new Error('Piper TTS synthesis failed');
    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);

    DOM.piperAudioPlayer.src = audioUrl;
    DOM.piperAudioPlayer.play();

    connectAudioAnalyser(DOM.piperAudioPlayer);

    DOM.piperAudioPlayer.onended = () => {
      if (speakBtn) speakBtn.classList.remove('playing');
      if (state.isVoiceCallActive) {
        setCallState('STANDBY');
      }
    };

    DOM.piperAudioPlayer.onerror = () => {
      if (speakBtn) speakBtn.classList.remove('playing');
    };

  } catch (err) {
    console.error('Audio playback error:', err);
    if (speakBtn) speakBtn.classList.remove('playing');
  }
}

// ==========================================
// MICROPHONE RECORDING & WHISPER STT
// ==========================================

async function toggleAudioRecording() {
  if (state.isRecording) {
    stopAudioRecording();
  } else {
    startAudioRecording();
  }
}

async function startAudioRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };

    state.mediaRecorder.onstop = handleAudioUpload;

    state.mediaRecorder.start();
    state.isRecording = true;
    DOM.micBtn.classList.add('recording');
    if (DOM.voiceWavePreview) DOM.voiceWavePreview.style.display = 'flex';

    connectStreamAnalyser(stream);

  } catch (err) {
    console.error('Microphone access denied:', err);
    alert('Microphone permission required for voice input.');
  }
}

function stopAudioRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;
    DOM.micBtn.classList.remove('recording');
    if (DOM.voiceWavePreview) DOM.voiceWavePreview.style.display = 'none';
  }
}

async function handleAudioUpload() {
  const audioBlob = new Blob(state.audioChunks, { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('audio', audioBlob, 'input.wav');

  DOM.promptInput.placeholder = 'Transcribing voice input via Faster-Whisper...';

  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Whisper transcription failed');
    const data = await res.json();
    
    if (data.text) {
      if (state.activeView === 'voice') {
        handleVoiceCallInput(data.text);
      } else {
        DOM.promptInput.value = data.text;
        handleUserSubmit();
      }
    }
  } catch (err) {
    console.error('Whisper transcription error:', err);
  } finally {
    DOM.promptInput.placeholder = 'Ask TouchCall or press mic for voice input...';
  }
}

// ==========================================
// TACTILE VOICE CALL INTERFACE (BRANDKIT PANEL 7)
// ==========================================

function setCallState(newState) {
  state.callState = newState;
  DOM.callStateLabel.innerText = newState;

  switch (newState) {
    case 'STANDBY':
      DOM.voiceCallCaption.innerText = 'TAP TO TRANSMIT';
      DOM.voiceCallOrbBtn.classList.remove('calling');
      break;
    case 'LISTENING':
      DOM.voiceCallCaption.innerText = 'LISTENING...';
      DOM.voiceCallOrbBtn.classList.add('calling');
      DOM.voiceSubtitleText.innerText = 'Listening to your voice...';
      break;
    case 'THINKING':
      DOM.voiceCallCaption.innerText = 'THINKING...';
      DOM.voiceCallOrbBtn.classList.remove('calling');
      DOM.voiceSubtitleText.innerText = 'Qwen 2.5 3B is reasoning on silicon...';
      break;
    case 'SPEAKING':
      DOM.voiceCallCaption.innerText = 'SPEAKING';
      DOM.voiceCallOrbBtn.classList.remove('calling');
      break;
  }
}

async function handleVoiceCallOrbClick() {
  if (state.callState === 'LISTENING') {
    setCallState('THINKING');
    stopAudioRecording();
  } else if (state.callState === 'STANDBY') {
    setCallState('LISTENING');
    state.isVoiceCallActive = true;
    startAudioRecording();
  }
}

async function handleVoiceCallInput(userText) {
  DOM.voiceSubtitleText.innerText = `You: "${userText}"`;
  setCallState('THINKING');

  state.conversationHistory.push({ role: 'user', content: userText });

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.conversationHistory,
        system_prompt: state.systemPresets['touchcall'],
        temperature: 0.6,
        max_tokens: 150,
        stream: false
      })
    });

    if (!res.ok) throw new Error('Voice call LLM failure');
    const data = await res.json();
    const reply = data.response;

    DOM.voiceSubtitleText.innerText = `TouchCall: "${reply}"`;
    state.conversationHistory.push({ role: 'assistant', content: reply });

    setCallState('SPEAKING');
    synthesizeAndPlay(reply);

  } catch (err) {
    DOM.voiceSubtitleText.innerText = `Error: ${err.message}`;
    setCallState('STANDBY');
  }
}

function initRotaryKnobPhysics() {
  let isDragging = false;
  let currentAngle = 0;
  let startY = 0;

  if (!DOM.rotaryKnob) return;

  DOM.rotaryKnob.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    document.body.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;
    currentAngle = (currentAngle + deltaY * 1.5) % 360;
    DOM.rotaryKnob.style.transform = `rotate(${currentAngle}deg)`;
    startY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = 'default';
    }
  });
}

function initLandingKnobPhysics() {
  let isDragging = false;
  let currentAngle = 0;
  let startY = 0;

  if (!DOM.landingKnobWheel) return;

  DOM.landingKnobWheel.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    document.body.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;
    currentAngle = (currentAngle + deltaY * 1.8) % 360;
    DOM.landingKnobWheel.style.transform = `rotate(${currentAngle}deg)`;
    startY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = 'default';
    }
  });
}

// ==========================================
// ANIMATED AMBIENT CANVAS (HERO BACKGROUND)
// ==========================================

function initAmbientHeroCanvas() {
  const canvas = DOM.ambientHeroCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = canvas.width = canvas.parentElement.offsetWidth;
  let height = canvas.height = canvas.parentElement.offsetHeight;

  window.addEventListener('resize', () => {
    if (!canvas.parentElement) return;
    width = canvas.width = canvas.parentElement.offsetWidth;
    height = canvas.height = canvas.parentElement.offsetHeight;
  });

  const particles = [];
  const particleCount = 45;
  let mouse = { x: width / 2, y: height / 2, active: false };

  canvas.parentElement.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });

  canvas.parentElement.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2 + 1,
      color: Math.random() > 0.4 ? '#FF5C00' : '#8B949E'
    });
  }

  function renderAmbient() {
    requestAnimationFrame(renderAmbient);
    ctx.clearRect(0, 0, width, height);

    // Draw connecting circuit links
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 92, 0, ${(1 - dist / 120) * 0.18})`;
          ctx.lineWidth = 1;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Update and draw particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      // Mouse attraction / gentle interaction
      if (mouse.active) {
        const mdx = mouse.x - p.x;
        const mdy = mouse.y - p.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 140) {
          p.x += (mdx / mdist) * 0.8;
          p.y += (mdy / mdist) * 0.8;
        }
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.color === '#FF5C00' ? 6 : 0;
      ctx.fill();
    }
  }

  renderAmbient();
}

// ==========================================
// HERO FLOATING DOCK WAVEFORM CANVAS
// ==========================================

function initHeroDockWaveform() {
  const canvas = DOM.heroDockWaveCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function renderDockWave() {
    requestAnimationFrame(renderDockWave);
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barCount = 28;
    const barWidth = 4;
    const gap = (width - (barCount * barWidth)) / (barCount + 1);
    const t = Date.now() * 0.003;

    for (let i = 0; i < barCount; i++) {
      const h = Math.sin(t + i * 0.35) * 8 + 14;
      const x = gap + i * (barWidth + gap);
      const y = (height - h) / 2;

      ctx.fillStyle = '#FF5C00';
      ctx.shadowColor = 'rgba(255, 92, 0, 0.4)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, h, [2]);
      ctx.fill();
    }
  }

  renderDockWave();
}

// ==========================================
// CANVAS ACOUSTIC WAVEFORM DRAWERS (VOICE STAGE)
// ==========================================

let analyserDataArray = null;

function connectStreamAnalyser(stream) {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 64;
  source.connect(state.analyser);
  analyserDataArray = new Uint8Array(state.analyser.frequencyBinCount);
}

function connectAudioAnalyser(audioEl) {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  try {
    const source = state.audioContext.createMediaElementSource(audioEl);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 64;
    source.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);
    analyserDataArray = new Uint8Array(state.analyser.frequencyBinCount);
  } catch (e) {
    // Already connected
  }
}

function initVoiceCanvasDrawers() {
  const vCanvas = DOM.voiceCallCanvas;
  if (!vCanvas) return;
  const vCtx = vCanvas.getContext('2d');

  function renderWaveform() {
    requestAnimationFrame(renderWaveform);

    const width = vCanvas.width;
    const height = vCanvas.height;
    vCtx.clearRect(0, 0, width, height);

    const barCount = 36;
    const barWidth = 6;
    const gap = (width - (barCount * barWidth)) / (barCount + 1);

    if (state.analyser && analyserDataArray) {
      state.analyser.getByteFrequencyData(analyserDataArray);
    }

    const time = Date.now() * 0.003;

    for (let i = 0; i < barCount; i++) {
      let value = 15;
      if (analyserDataArray && analyserDataArray.length > 0) {
        const dataIdx = Math.floor((i / barCount) * analyserDataArray.length);
        value = (analyserDataArray[dataIdx] / 255) * (height - 30) + 10;
      } else if (state.callState === 'SPEAKING' || state.callState === 'LISTENING') {
        value = Math.sin(time + i * 0.3) * 35 + 45;
      } else {
        value = Math.sin(time * 0.5 + i * 0.2) * 8 + 14;
      }

      const x = gap + i * (barWidth + gap);
      const y = (height - value) / 2;

      vCtx.fillStyle = '#FF5C00';
      vCtx.shadowColor = 'rgba(255, 92, 0, 0.5)';
      vCtx.shadowBlur = 8;
      
      vCtx.beginPath();
      vCtx.roundRect(x, y, barWidth, value, [3]);
      vCtx.fill();
    }
  }

  renderWaveform();
}
