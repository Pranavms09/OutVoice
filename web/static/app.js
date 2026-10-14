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
  chatAbort: null,
  voicePlaybackEnabled: true,
  mediaRecorder: null,
  audioChunks: [],
  audioContext: null,
  micAnalyser: null,   // Terminal dictation mic
  playAnalyser: null,  // Piper playback
  stopPlayback: null,
  call: {
    active: false,
    phase: 'idle',     // 'idle' | 'ready' | 'listening' | 'thinking' | 'speaking'
    mode: 'handsfree', // 'handsfree' | 'ptt'
    muted: false,
    sensitivity: 6,
    bargeIn: false,
    stream: null,
    micAnalyser: null,
    recorder: null,
    chunks: [],
    discard: false,
    abort: null,
    startedAt: 0,
    timerId: 0,
    vadTimer: 0,
    speechStarted: false,
    lastVoiceAt: 0,
    turnStartedAt: 0
  },
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
  
  // Header Telemetry
  backendTag: document.getElementById('backendTag'),
  tpsTag: document.getElementById('tpsTag'),
  latencyTag: document.getElementById('latencyTag'),
  
  // Chat Terminal
  messagesContainer: document.getElementById('messagesContainer'),
  emptyState: document.getElementById('emptyState'),
  promptInput: document.getElementById('promptInput'),
  sendBtn: document.getElementById('sendBtn'),
  micBtn: document.getElementById('micBtn'),
  voiceWavePreview: document.getElementById('voiceWavePreview'),
  miniWaveCanvas: document.getElementById('miniWaveCanvas'),
  chatTtsToggle: document.getElementById('chatTtsToggle'),
  chatClearBtn: document.getElementById('chatClearBtn'),
  llmDot: document.getElementById('llmDot'),
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
  
  // Voice Call
  callRoot: document.querySelector('#voiceView .call'),
  callStateLabel: document.getElementById('callStateLabel'),
  callTimer: document.getElementById('callTimer'),
  callHint: document.getElementById('callHint'),
  voiceCallCanvas: document.getElementById('voiceCallCanvas'),
  voiceCallOrbBtn: document.getElementById('voiceCallOrbBtn'),
  callStartBtn: document.getElementById('callStartBtn'),
  callStartLabel: document.getElementById('callStartLabel'),
  callMuteBtn: document.getElementById('callMuteBtn'),
  ttsVoiceToggleBtn: document.getElementById('ttsVoiceToggleBtn'),
  modeBtns: document.querySelectorAll('#voiceView .mode-btn'),
  vadSensitivity: document.getElementById('vadSensitivity'),
  callTranscript: document.getElementById('callTranscript'),
  callLogClear: document.getElementById('callLogClear')
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();

  // Deep links from the marketing site: /#chat, /#voice, /#landing
  const openFromHash = () => {
    const view = location.hash.slice(1);
    if (['landing', 'chat', 'voice'].includes(view)) switchView(view);
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  initSliders();
  initCustomPrompt();
  fetchTelemetry();
  setInterval(fetchTelemetry, 4000);
  
  initVoiceCall();
});

function initEventListeners() {
  // Navigation Tabs & View Routing
  if (DOM.tabLandingBtn) DOM.tabLandingBtn.addEventListener('click', () => switchView('landing'));
  if (DOM.tabChatBtn) DOM.tabChatBtn.addEventListener('click', () => switchView('chat'));
  if (DOM.tabVoiceBtn) DOM.tabVoiceBtn.addEventListener('click', () => switchView('voice'));

  // Prompt Send & Input Auto-grow
  DOM.sendBtn.addEventListener('click', () => state.isGenerating ? stopGeneration() : handleUserSubmit());
  DOM.chatTtsToggle.addEventListener('click', () => setVoicePlayback(!state.voicePlaybackEnabled));
  DOM.chatClearBtn.addEventListener('click', clearConversation);
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

  // Quick Prompt Chips in the Terminal empty state
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


}

function switchView(viewName) {
  // Leaving the call screen hangs up so the mic is never left open in the background.
  if (viewName !== 'voice' && state.call.active) endCall();
  state.activeView = viewName;
  document.body.dataset.view = viewName;
  // Keep the view in the URL so reloads and links from the Overview page land correctly.
  history.replaceState(null, '', `#${viewName}`);

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
  stopGeneration();
  stopSpeech();
  DOM.messagesContainer.innerHTML = '';
  DOM.messagesContainer.appendChild(DOM.emptyState);
  DOM.tpsTag.innerText = '-- tok/s';
  DOM.latencyTag.innerText = '-- ms TTFT';
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

    const ramPct = Math.round((data.memory_used_gb / data.memory_total_gb) * 100);
    DOM.ramProgress.style.width = `${ramPct}%`;

    DOM.cpuStat.innerText = `${Math.round(data.cpu_usage_pct)}%`;
    DOM.cpuProgress.style.width = `${Math.round(data.cpu_usage_pct)}%`;

    DOM.backendTag.innerText = data.server_active ? 'llama-server · online' : 'llama-completion CLI (fallback)';
    DOM.llmDot.className = `t-dot ${data.server_active ? 'online' : 'offline'}`;

  } catch (err) {
    DOM.backendTag.innerText = 'backend unreachable';
    DOM.llmDot.className = 't-dot offline';
    console.debug('Telemetry poll error:', err);
  }
}

// ==========================================
// CHAT INFERENCE & STREAMING (TERMINAL)
// ==========================================

const OFFLINE_HINT = 'Could not reach the local model. Make sure TouchCall is running (./launch_web.sh) and llama-server has finished loading.';

const LOGO_MARK = `<svg width="14" height="12" viewBox="0 0 100 80" fill="none"><path d="M42 12 H62 V22 H42 Z" fill="#F0F3F6"/><path d="M62 12 H82 L72 22 H62 Z" fill="#FF5C00"/><path d="M57 22 H67 V68 H57 Z" fill="#F0F3F6"/></svg>`;

function hideEmptyState() {
  if (DOM.emptyState && DOM.emptyState.parentNode) DOM.emptyState.remove();
}

function scrollChatToBottom() {
  DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
}

function setGenerating(on) {
  state.isGenerating = on;
  DOM.sendBtn.classList.toggle('is-stop', on);
  DOM.sendBtn.title = on ? 'Stop generating' : 'Send (Enter)';
  DOM.sendBtn.setAttribute('aria-label', on ? 'Stop generating' : 'Send');
}

function stopGeneration() {
  if (state.chatAbort) state.chatAbort.abort();
}

async function handleUserSubmit() {
  if (state.isGenerating) return;
  const prompt = DOM.promptInput.value.trim();
  if (!prompt) return;

  DOM.promptInput.value = '';
  DOM.promptInput.style.height = 'auto';
  hideEmptyState();

  appendMessage('user', prompt);
  state.conversationHistory.push({ role: 'user', content: prompt });

  const assistantCard = appendMessage('assistant', '', true);
  setGenerating(true);
  state.chatAbort = new AbortController();

  const startTime = performance.now();
  let accumulatedText = '';
  let firstTokenTime = null;

  try {
    const systemPrompt = DOM.customSystemPromptInput.value || state.systemPresets[state.currentPreset];
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: state.chatAbort.signal,
      body: JSON.stringify({
        messages: state.conversationHistory,
        system_prompt: systemPrompt,
        temperature: state.hyperparams.temperature,
        max_tokens: state.hyperparams.max_tokens,
        top_p: state.hyperparams.top_p,
        stream: true
      })
    });

    if (!response.ok) throw new Error(`Inference HTTP ${response.status}`);

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

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
              DOM.latencyTag.innerText = `${ttft}ms TTFT`;
            }
            accumulatedText += parsed.token;
            renderAssistantContent(assistantCard, accumulatedText, false);
          }
          if (parsed.done && parsed.metrics) {
            DOM.tpsTag.innerText = `${parsed.metrics.tps} tok/s`;
            renderAssistantMetrics(assistantCard, parsed.metrics);
          }
        } catch (err) {
          console.debug('SSE parse chunk error:', err);
        }
      }
    }

    renderAssistantContent(assistantCard, accumulatedText, true);
    state.conversationHistory.push({ role: 'assistant', content: accumulatedText });

    if (state.voicePlaybackEnabled && accumulatedText) {
      synthesizeAndPlay(accumulatedText, assistantCard);
    }
  } catch (err) {
    const body = assistantCard.querySelector('.message-body');
    if (err.name === 'AbortError') {
      renderAssistantContent(assistantCard, accumulatedText, true);
      body.insertAdjacentHTML('beforeend', '<p class="msg-note">Stopped.</p>');
      if (accumulatedText) {
        state.conversationHistory.push({ role: 'assistant', content: accumulatedText });
      } else {
        state.conversationHistory.pop();
      }
    } else {
      console.error('Inference error:', err);
      body.innerHTML = `<p class="msg-error">${escapeHtml(OFFLINE_HINT)}</p><p class="msg-note">${escapeHtml(err.message)}</p>`;
      state.conversationHistory.pop();
    }
  } finally {
    setGenerating(false);
    state.chatAbort = null;
    DOM.promptInput.focus();
  }
}

function showChatNotice(text) {
  hideEmptyState();
  const row = document.createElement('div');
  row.className = 'msg ai';
  row.innerHTML = '<div class="message-body"><p class="msg-error"></p></div>';
  row.querySelector('p').textContent = text;
  DOM.messagesContainer.appendChild(row);
  scrollChatToBottom();
}

// ==========================================
// UI MESSAGE RENDERING & MARKDOWN
// ==========================================

function appendMessage(role, text, isPending = false) {
  const row = document.createElement('div');
  row.className = `msg ${role === 'user' ? 'user' : 'ai'}`;
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (role === 'user') {
    row.innerHTML = '<div class="msg-bubble"></div>';
    row.querySelector('.msg-bubble').textContent = text;
  } else {
    row.innerHTML = `
      <div class="msg-head">
        <span class="msg-mark">${LOGO_MARK}</span>
        <span class="msg-who">TOUCHCALL</span>
        <span>${timeStr}</span>
        <span class="msg-metrics"></span>
      </div>
      <div class="message-body">${isPending ? '<span class="typing-cursor"></span>' : renderMarkdown(text)}</div>
      <div class="msg-actions"${isPending ? ' hidden' : ''}>
        <button class="msg-act speak-btn" title="Read aloud with Piper">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          <span>Speak</span>
        </button>
        <button class="msg-act copy-btn" title="Copy text">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copy</span>
        </button>
      </div>
    `;
    if (!isPending) row.setAttribute('data-raw-content', text);

    row.querySelector('.speak-btn').addEventListener('click', () => {
      synthesizeAndPlay(row.getAttribute('data-raw-content') || '', row);
    });
    const copyBtn = row.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(row.getAttribute('data-raw-content') || '').then(() => {
        const span = copyBtn.querySelector('span');
        span.innerText = 'Copied';
        setTimeout(() => span.innerText = 'Copy', 1500);
      });
    });
  }

  DOM.messagesContainer.appendChild(row);
  scrollChatToBottom();
  return row;
}

function renderAssistantContent(card, text, isDone) {
  card.setAttribute('data-raw-content', text);
  const bodyEl = card.querySelector('.message-body');
  if (bodyEl) {
    bodyEl.innerHTML = renderMarkdown(text) + (isDone ? '' : '<span class="typing-cursor"></span>');
  }
  if (isDone) {
    const actionsEl = card.querySelector('.msg-actions');
    if (actionsEl) actionsEl.hidden = !text;
  }
  scrollChatToBottom();
}

function renderAssistantMetrics(card, m) {
  const tag = card.querySelector('.msg-metrics');
  if (!tag) return;
  const parts = [`${m.tps} tok/s`];
  if (m.ttft_ms) parts.push(`${Math.round(m.ttft_ms)}ms TTFT`);
  tag.innerText = parts.join(' · ');
}

function renderMarkdown(raw) {
  if (!raw) return '';
  let text = escapeHtml(raw);

  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = 'code_' + Math.random().toString(36).substring(2, 9);
    return `<div class="code-block-wrapper"><div class="code-header"><span>${lang ? lang.toUpperCase() : 'CODE'}</span><button class="copy-code-btn" onclick="copyCodeBlock('${id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span></button></div><pre><code id="${id}">${code}</code></pre></div>`;
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
        btn.innerText = 'Copied';
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
// AUDIO PLUMBING (SHARED)
// ==========================================

function getAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioContext.state === 'suspended') state.audioContext.resume();
  return state.audioContext;
}

function getMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  });
}

function makeMicAnalyser(stream) {
  const ctx = getAudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  return analyser;
}

function pickMimeType() {
  if (!window.MediaRecorder) return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

function newRecorder(stream) {
  const mimeType = pickMimeType();
  return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
}

async function transcribeBlob(blob, signal) {
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
  const formData = new FormData();
  formData.append('audio', blob, `input.${ext}`);
  const res = await fetch('/api/transcribe', { method: 'POST', body: formData, signal });
  if (!res.ok) throw new Error(`Whisper HTTP ${res.status}`);
  const data = await res.json();
  return (data.text || '').trim();
}

// ==========================================
// PIPER TTS PLAYBACK
// ==========================================

// One media-element source per <audio>; the browser forbids creating a second.
function ensurePlaybackAnalyser() {
  if (state.playAnalyser) return;
  try {
    const ctx = getAudioContext();
    const source = ctx.createMediaElementSource(DOM.piperAudioPlayer);
    state.playAnalyser = ctx.createAnalyser();
    state.playAnalyser.fftSize = 128;
    source.connect(state.playAnalyser);
    state.playAnalyser.connect(ctx.destination);
  } catch (err) {
    console.debug('Playback analyser unavailable:', err);
  }
}

function stopSpeech() {
  if (state.stopPlayback) state.stopPlayback();
}

// Resolves when playback ends, fails, or is interrupted, so callers can chain turns.
async function synthesizeAndPlay(text, cardEl = null) {
  const speech = text
    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
    .replace(/`[^`]+`/g, '')
    .replace(/[*#_~]/g, '')
    .trim();
  if (!speech) return;

  stopSpeech();
  const speakBtn = cardEl ? cardEl.querySelector('.speak-btn') : null;
  if (speakBtn) speakBtn.classList.add('playing');

  try {
    const res = await fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: speech })
    });
    if (!res.ok) throw new Error(`Piper HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());

    ensurePlaybackAnalyser();
    const player = DOM.piperAudioPlayer;
    await new Promise((resolve) => {
      const done = () => {
        player.onended = player.onerror = null;
        state.stopPlayback = null;
        URL.revokeObjectURL(url);
        resolve();
      };
      player.onended = done;
      player.onerror = done;
      state.stopPlayback = () => { player.pause(); done(); };
      player.src = url;
      player.play().catch(done);
    });
  } catch (err) {
    console.error('Audio playback error:', err);
  } finally {
    if (speakBtn) speakBtn.classList.remove('playing');
  }
}

function setVoicePlayback(on) {
  state.voicePlaybackEnabled = on;
  DOM.chatTtsToggle.setAttribute('aria-pressed', String(on));
  DOM.chatTtsToggle.textContent = `Piper voice: ${on ? 'on' : 'off'}`;
  DOM.ttsVoiceToggleBtn.setAttribute('aria-pressed', String(on));
  DOM.ttsVoiceToggleBtn.querySelector('span').textContent = on ? 'Voice on' : 'Voice off';
  if (!on) stopSpeech();
}

// ==========================================
// TERMINAL MIC (WHISPER DICTATION)
// ==========================================

async function toggleAudioRecording() {
  if (state.isRecording) {
    stopAudioRecording();
  } else {
    startAudioRecording();
  }
}

async function startAudioRecording() {
  if (state.isGenerating) return;
  let stream;
  try {
    stream = await getMic();
  } catch (err) {
    showChatNotice('Microphone permission is needed for voice input. Allow it in your browser and try again.');
    return;
  }

  state.audioChunks = [];
  state.mediaRecorder = newRecorder(stream);
  state.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) state.audioChunks.push(e.data);
  };
  state.mediaRecorder.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    state.micAnalyser = null;
    handleAudioUpload();
  };

  state.mediaRecorder.start();
  state.isRecording = true;
  state.micAnalyser = makeMicAnalyser(stream);
  DOM.micBtn.classList.add('recording');
  DOM.voiceWavePreview.hidden = false;
  drawMiniWave();
}

function stopAudioRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.isRecording = false;
    state.mediaRecorder.stop();
    DOM.micBtn.classList.remove('recording');
    DOM.voiceWavePreview.hidden = true;
  }
}

async function handleAudioUpload() {
  const blob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType || 'audio/webm' });
  DOM.promptInput.placeholder = 'Transcribing with Whisper…';
  try {
    const text = await transcribeBlob(blob);
    if (text) {
      DOM.promptInput.value = text;
      handleUserSubmit();
    } else {
      DOM.promptInput.placeholder = "Didn't catch that. Try again…";
    }
  } catch (err) {
    showChatNotice(`Transcription failed: ${err.message}`);
  } finally {
    setTimeout(() => { DOM.promptInput.placeholder = 'Message TouchCall…'; }, 2500);
  }
}

function drawMiniWave() {
  const canvas = DOM.miniWaveCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = new Uint8Array(1024);
  const bars = 40;

  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.isRecording || !state.micAnalyser) return;
    state.micAnalyser.getByteTimeDomainData(data);
    const step = Math.floor(data.length / bars);
    const w = canvas.width / bars;
    ctx.fillStyle = '#00E5FF';
    for (let i = 0; i < bars; i++) {
      const amp = Math.abs(data[i * step] - 128) / 128;
      const h = Math.max(2, amp * canvas.height * 2.2);
      ctx.fillRect(i * w + 1, (canvas.height - h) / 2, w - 2, Math.min(h, canvas.height));
    }
    requestAnimationFrame(frame);
  };
  frame();
}

// ==========================================
// VOICE CALL ENGINE
// ==========================================

const SILENCE_MS = 900;         // pause after speech that ends a turn
const MAX_TURN_MS = 30000;      // hard cap on one spoken turn
const IDLE_RECYCLE_MS = 15000;  // restart an empty recording so blobs stay small

const PHASE_LABEL = {
  idle: 'READY',
  ready: 'YOUR TURN',
  listening: 'LISTENING',
  thinking: 'THINKING',
  speaking: 'SPEAKING'
};

function setPhase(phase, hint) {
  const c = state.call;
  c.phase = phase;
  DOM.callRoot.dataset.phase = phase === 'ready' ? 'idle' : phase;
  DOM.callStateLabel.textContent = c.active && c.muted ? 'MUTED' : PHASE_LABEL[phase];
  if (hint !== undefined) DOM.callHint.textContent = hint;
}

function updateCallTimer() {
  const secs = state.call.active ? Math.floor((Date.now() - state.call.startedAt) / 1000) : 0;
  DOM.callTimer.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

// Sensitivity 1..10 maps to an RMS threshold of 0.05 (deaf) .. 0.008 (very sensitive).
function vadThreshold() {
  return 0.05 - (state.call.sensitivity - 1) * (0.042 / 9);
}

async function startCall() {
  const c = state.call;
  if (c.active) return;
  try {
    c.stream = await getMic();
  } catch (err) {
    setPhase('idle', 'Microphone permission is needed for voice calls. Allow it in your browser and try again.');
    return;
  }

  c.micAnalyser = makeMicAnalyser(c.stream);
  c.active = true;
  c.muted = false;
  c.bargeIn = false;
  c.startedAt = Date.now();
  c.timerId = setInterval(updateCallTimer, 1000);
  updateCallTimer();

  DOM.callStartBtn.classList.add('is-end');
  DOM.callStartLabel.textContent = 'End call';
  DOM.callMuteBtn.disabled = false;
  DOM.voiceCallOrbBtn.setAttribute('aria-label', 'Talk or interrupt');
  addLog('sys', 'Call started.');

  if (c.mode === 'handsfree') {
    beginListening();
  } else {
    setPhase('ready', 'Tap the orb and speak. Tap again when you are done.');
  }
}

function endCall() {
  const c = state.call;
  if (!c.active) return;
  c.active = false;

  stopVad();
  if (c.recorder && c.recorder.state !== 'inactive') {
    c.discard = true;
    c.recorder.stop();
  }
  if (c.abort) c.abort.abort();
  stopSpeech();
  if (c.stream) c.stream.getTracks().forEach(t => t.stop());
  c.stream = null;
  c.micAnalyser = null;
  clearInterval(c.timerId);

  c.muted = false;
  DOM.callRoot.classList.remove('is-muted');
  DOM.callMuteBtn.disabled = true;
  DOM.callMuteBtn.setAttribute('aria-pressed', 'false');
  DOM.callMuteBtn.querySelector('span').textContent = 'Mute';
  DOM.callStartBtn.classList.remove('is-end');
  DOM.callStartLabel.textContent = 'Start call';
  DOM.voiceCallOrbBtn.setAttribute('aria-label', 'Start call');
  updateCallTimer();
  addLog('sys', 'Call ended.');
  setPhase('idle', 'Call ended. Start a new call any time.');
}

function beginListening() {
  const c = state.call;
  if (!c.active) return;
  if (c.muted) {
    setPhase('listening', 'You are muted. Unmute to talk.');
    return;
  }

  c.chunks = [];
  c.discard = false;
  c.recorder = newRecorder(c.stream);
  c.recorder.ondataavailable = (e) => {
    if (e.data.size > 0) c.chunks.push(e.data);
  };
  c.recorder.onstop = onCallRecorderStop;
  c.recorder.start();

  c.speechStarted = false;
  c.lastVoiceAt = 0;
  c.turnStartedAt = Date.now();
  setPhase('listening', c.mode === 'handsfree'
    ? 'Listening… TouchCall replies when you pause.'
    : 'Listening… tap the orb when you are done.');
  if (c.mode === 'handsfree') startVad();
}

// Interval, not requestAnimationFrame, so the call keeps working in a background tab.
function startVad() {
  const c = state.call;
  stopVad();
  const data = new Float32Array(c.micAnalyser.fftSize);
  c.vadTimer = setInterval(() => {
    if (!c.active || c.phase !== 'listening' || !c.micAnalyser) return stopVad();
    c.micAnalyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const now = Date.now();

    if (rms > vadThreshold()) {
      c.speechStarted = true;
      c.lastVoiceAt = now;
    }
    if (c.speechStarted && (now - c.lastVoiceAt > SILENCE_MS || now - c.turnStartedAt > MAX_TURN_MS)) {
      finishTurn();
    } else if (!c.speechStarted && now - c.turnStartedAt > IDLE_RECYCLE_MS) {
      stopVad();
      c.discard = true;
      c.recorder.stop(); // onstop restarts listening
    }
  }, 50);
}

function stopVad() {
  clearInterval(state.call.vadTimer);
  state.call.vadTimer = 0;
}

function finishTurn() {
  const c = state.call;
  stopVad();
  if (c.recorder && c.recorder.state === 'recording') {
    setPhase('thinking', 'Transcribing with Whisper…');
    c.recorder.stop();
  }
}

function nextTurn() {
  const c = state.call;
  if (!c.active) return;
  const listen = c.mode === 'handsfree' || c.bargeIn;
  c.bargeIn = false;
  if (listen) {
    beginListening();
  } else {
    setPhase('ready', 'Tap the orb to talk.');
  }
}

async function onCallRecorderStop() {
  const c = state.call;
  if (!c.active) return;
  if (c.discard) {
    c.discard = false;
    if (c.phase === 'listening') beginListening();
    return;
  }

  const blob = new Blob(c.chunks, { type: c.recorder.mimeType || 'audio/webm' });
  c.abort = new AbortController();
  try {
    setPhase('thinking', 'Transcribing with Whisper…');
    const text = await transcribeBlob(blob, c.abort.signal);
    if (!c.active) return;
    if (text.replace(/[^a-z0-9]/gi, '').length < 2) {
      addLog('sys', "Didn't catch that. Try again.");
      nextTurn();
      return;
    }

    addLog('you', text);
    setPhase('thinking', 'Qwen is thinking…');
    const reply = await askModel(text, c.abort.signal);
    if (!c.active) return;
    addLog('tc', reply);

    if (state.voicePlaybackEnabled) {
      setPhase('speaking', 'Speaking… tap the orb to interrupt.');
      await synthesizeAndPlay(reply);
    }
    nextTurn();
  } catch (err) {
    if (err.name === 'AbortError' || !c.active) return;
    console.error('Voice turn failed:', err);
    addLog('sys', OFFLINE_HINT);
    nextTurn();
  } finally {
    c.abort = null;
  }
}

// One non-streamed reply; the turn is mirrored into the Terminal history.
async function askModel(text, signal) {
  state.conversationHistory.push({ role: 'user', content: text });
  hideEmptyState();
  appendMessage('user', text);

  let data;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        messages: state.conversationHistory,
        system_prompt: state.systemPresets.touchcall,
        temperature: 0.6,
        max_tokens: 150,
        top_p: state.hyperparams.top_p,
        stream: false
      })
    });
    if (!res.ok) throw new Error(`Inference HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    state.conversationHistory.pop();
    throw err;
  }

  const reply = (data.response || '').trim() || "Sorry, I don't have an answer for that.";
  state.conversationHistory.push({ role: 'assistant', content: reply });
  const card = appendMessage('assistant', reply);
  if (data.metrics) renderAssistantMetrics(card, data.metrics);
  return reply;
}

function handleOrbClick() {
  const c = state.call;
  if (!c.active) return startCall();
  if (c.muted) return;
  if (c.phase === 'ready') {
    beginListening();
  } else if (c.phase === 'listening') {
    finishTurn();
  } else if (c.phase === 'speaking') {
    c.bargeIn = true;
    stopSpeech(); // the pending turn resumes and calls nextTurn()
  }
}

function toggleMute() {
  const c = state.call;
  if (!c.active) return;
  c.muted = !c.muted;
  c.stream.getAudioTracks().forEach(t => { t.enabled = !c.muted; });
  DOM.callMuteBtn.setAttribute('aria-pressed', String(c.muted));
  DOM.callMuteBtn.querySelector('span').textContent = c.muted ? 'Unmute' : 'Mute';
  DOM.callRoot.classList.toggle('is-muted', c.muted);

  if (c.phase === 'listening') {
    stopVad();
    if (c.recorder && c.recorder.state === 'recording') {
      c.discard = true;
      c.recorder.stop(); // onstop re-enters beginListening, which respects mute
    } else {
      beginListening();
    }
  }
  setPhase(c.phase); // refresh the MUTED label right away
}

function setCallMode(mode) {
  const c = state.call;
  c.mode = mode;
  DOM.modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (!c.active) return;
  if (c.phase === 'listening' && !c.muted) {
    if (mode === 'handsfree') {
      startVad();
      setPhase('listening', 'Listening… TouchCall replies when you pause.');
    } else {
      stopVad();
      setPhase('listening', 'Listening… tap the orb when you are done.');
    }
  } else if (c.phase === 'ready' && mode === 'handsfree') {
    beginListening();
  }
}

function addLog(kind, text) {
  const empty = DOM.callTranscript.querySelector('.log-empty');
  if (empty) empty.remove();
  const who = { you: 'YOU', tc: 'TOUCHCALL', sys: 'SYSTEM' }[kind];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const turn = document.createElement('div');
  turn.className = `log-turn ${kind}`;
  turn.innerHTML = `<span class="log-who">${who} · ${time}</span><p></p>`;
  turn.querySelector('p').textContent = text;
  DOM.callTranscript.appendChild(turn);
  DOM.callTranscript.scrollTop = DOM.callTranscript.scrollHeight;
}

function clearCallLog() {
  DOM.callTranscript.innerHTML = '<p class="log-empty">Your call transcript will appear here.</p>';
}

function initVoiceCall() {
  DOM.voiceCallOrbBtn.addEventListener('click', handleOrbClick);
  DOM.callStartBtn.addEventListener('click', () => state.call.active ? endCall() : startCall());
  DOM.callMuteBtn.addEventListener('click', toggleMute);
  DOM.ttsVoiceToggleBtn.addEventListener('click', () => setVoicePlayback(!state.voicePlaybackEnabled));
  DOM.modeBtns.forEach(b => b.addEventListener('click', () => setCallMode(b.dataset.mode)));
  DOM.vadSensitivity.addEventListener('input', (e) => {
    state.call.sensitivity = parseInt(e.target.value, 10);
  });
  DOM.callLogClear.addEventListener('click', clearCallLog);
  window.addEventListener('beforeunload', endCall);
  setPhase('idle');
  initCallVisualizer();
}

// ==========================================
// VOICE CALL ORB VISUALIZER
// ==========================================

function initCallVisualizer() {
  const canvas = DOM.voiceCallCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const freq = new Uint8Array(64);
  const colors = { idle: '#565D6D', ready: '#8B949E', listening: '#00E5FF', thinking: '#FF5C00', speaking: '#FF5C00' };
  const bars = 72;

  const draw = () => {
    requestAnimationFrame(draw);
    if (state.activeView !== 'voice') return;

    const c = state.call;
    const size = canvas.width;
    const mid = size / 2;
    const radius = size * 0.24;
    const t = performance.now() / 1000;
    const phase = c.active && c.muted ? 'idle' : c.phase;
    const analyser = phase === 'listening' ? c.micAnalyser : phase === 'speaking' ? state.playAnalyser : null;
    if (analyser) analyser.getByteFrequencyData(freq);

    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';
    ctx.strokeStyle = colors[phase];

    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mid, mid, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 5;
    for (let i = 0; i < bars; i++) {
      let amp;
      if (analyser) {
        // mirror the spectrum so the ring is symmetric
        const pos = Math.abs((i / bars) * 2 - 1);
        amp = freq[Math.floor(pos * 40)] / 255;
      } else if (phase === 'thinking') {
        amp = 0.22 + 0.18 * Math.sin(t * 5 + i * 0.35);
      } else {
        amp = 0.05 + 0.035 * Math.sin(t * 1.4 + i * 0.3);
      }
      const len = 6 + amp * size * 0.18;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const r0 = radius + 14;
      ctx.globalAlpha = 0.35 + amp * 0.65;
      ctx.beginPath();
      ctx.moveTo(mid + Math.cos(angle) * r0, mid + Math.sin(angle) * r0);
      ctx.lineTo(mid + Math.cos(angle) * (r0 + len), mid + Math.sin(angle) * (r0 + len));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  draw();
}
