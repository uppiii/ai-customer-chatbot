import { buildSummary, classifyIntent, contextualizeFollowUp, detectOrderId, generateAgentReply, getOrderDetails, getProductDetails, getSuggestedQuestions, isAwaitingClarification, mockOrders } from './agent.js?v=audio-required-20260928';

const stateIndicator = document.querySelector('#stateIndicator');
const startCallBtn = document.querySelector('#startCallBtn');
const endCallBtn = document.querySelector('#endCallBtn');
const interruptBtn = document.querySelector('#interruptBtn');
const transcriptEl = document.querySelector('#transcript');
const orderHelperEl = document.querySelector('#orderHelper');
const summaryOutput = document.querySelector('#summaryOutput');
const manualInput = document.querySelector('#manualInput');
const sendManualBtn = document.querySelector('#sendManualBtn');
const copySummaryBtn = document.querySelector('#copySummaryBtn');
const clearTranscriptBtn = document.querySelector('#clearTranscriptBtn');
const quickActionsEl = document.querySelector('#quickActions');
const callTimerEl = document.querySelector('#callTimer');
const languageModeEl = document.querySelector('#languageMode');
const fullscreenBtn = document.querySelector('#fullscreenBtn');
const startRecordingBtn = document.querySelector('#startRecordingBtn');
const stopRecordingBtn = document.querySelector('#stopRecordingBtn');
const recordingStatus = document.querySelector('#recordingStatus');
const includeMicrophoneAudio = document.querySelector('#includeMicrophoneAudio');

const session = {
  transcript: [],
  active: false,
  recognition: null,
  assistantSpeaking: false,
  pendingIntent: null,
  pendingOrderId: null,
  lastIntent: 'UNKNOWN',
  lastOrderId: null,
  timerId: null,
  startTime: null,
  mediaRecorder: null,
  recordedChunks: [],
  recordingStream: null,
  recordingSourceStreams: [],
  recordingAudioContext: null,
  summary: {
    customer_intent: 'NONE',
    order_id: null,
    resolution_status: 'IN_PROGRESS',
    call_summary: 'No call recorded yet.'
  }
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setState(state) {
  stateIndicator.className = `state-indicator ${state}`;
  stateIndicator.textContent = state.charAt(0).toUpperCase() + state.slice(1);
}

function formatTime(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function startTimer() {
  session.startTime = Date.now();
  session.timerId = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    callTimerEl.textContent = formatTime(elapsed);
  }, 1000);
}

function stopTimer() {
  if (session.timerId) {
    window.clearInterval(session.timerId);
    session.timerId = null;
  }
  callTimerEl.textContent = '00:00';
}

function getRecordingMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) return '';
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
}

function stopRecordingTracks() {
  session.recordingSourceStreams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
  session.recordingStream?.getTracks().forEach((track) => track.stop());
  session.recordingAudioContext?.close().catch(() => {});
  session.recordingStream = null;
  session.recordingSourceStreams = [];
  session.recordingAudioContext = null;
}

function downloadRecording() {
  if (!session.recordedChunks.length) {
    recordingStatus.textContent = 'No video captured';
    recordingStatus.classList.remove('recording');
    return;
  }

  const blob = new Blob(session.recordedChunks, { type: session.mediaRecorder?.mimeType || 'video/webm' });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = `aura-skincare-demo-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  recordingStatus.textContent = 'Video downloaded';
  recordingStatus.classList.remove('recording');
}

async function startDemoRecording() {
  if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
    recordingStatus.textContent = 'Screen recording is not supported by this browser';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 30 } },
      audio: true,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      systemAudio: 'include'
    });
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      stream.getTracks().forEach((track) => track.stop());
      recordingStatus.textContent = 'No screen or tab was selected';
      return;
    }

    const tabAudioTracks = stream.getAudioTracks();
    if (!tabAudioTracks.length) {
      stream.getTracks().forEach((track) => track.stop());
      recordingStatus.textContent = 'No audio shared. Select this tab and enable Share tab audio, then retry.';
      recordingStatus.classList.remove('recording');
      return;
    }

    session.recordingSourceStreams = [stream];
    let microphoneStream = null;
    if (includeMicrophoneAudio.checked) {
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
        session.recordingSourceStreams.push(microphoneStream);
      } catch (error) {
        recordingStatus.textContent = 'Microphone unavailable; recording selected tab audio only';
      }
    }

    const microphoneTracks = microphoneStream?.getAudioTracks() || [];
    let outputAudioTracks = tabAudioTracks;

    if (microphoneTracks.length && tabAudioTracks.length) {
      try {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        session.recordingAudioContext = audioContext;
        [...tabAudioTracks, ...microphoneTracks].forEach((track) => {
          const source = audioContext.createMediaStreamSource(new MediaStream([track]));
          source.connect(destination);
        });
        await audioContext.resume();
        outputAudioTracks = destination.stream.getAudioTracks();
      } catch (error) {
        recordingStatus.textContent = 'Audio mixing failed; recording tab audio only';
        outputAudioTracks = tabAudioTracks;
      }
    }

    if (!outputAudioTracks.length) {
      stopRecordingTracks();
      recordingStatus.textContent = 'No audio source available. Enable Share tab audio and retry.';
      recordingStatus.classList.remove('recording');
      return;
    }

    session.recordedChunks = [];
    session.recordingStream = new MediaStream([
      videoTrack,
      ...outputAudioTracks
    ]);
    const mimeType = getRecordingMimeType();
    session.mediaRecorder = new MediaRecorder(session.recordingStream, mimeType ? { mimeType } : undefined);
    session.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) session.recordedChunks.push(event.data);
    });
    session.mediaRecorder.addEventListener('stop', () => {
      stopRecordingTracks();
      downloadRecording();
      startRecordingBtn.disabled = false;
      stopRecordingBtn.disabled = true;
      session.mediaRecorder = null;
    }, { once: true });
    videoTrack.addEventListener('ended', () => {
      if (session.mediaRecorder?.state === 'recording') session.mediaRecorder.stop();
    }, { once: true });

    session.mediaRecorder.start(1000);
    const mutedAudioTracks = outputAudioTracks.filter((track) => track.muted || track.readyState !== 'live');
    recordingStatus.textContent = mutedAudioTracks.length
      ? 'Audio track shared but currently muted; check Share tab audio'
      : microphoneStream ? 'Recording tab and microphone audio' : 'Recording tab audio';
    outputAudioTracks.forEach((track) => {
      track.addEventListener('mute', () => {
        if (session.mediaRecorder?.state === 'recording') {
          recordingStatus.textContent = 'Audio track muted; check the browser tab audio setting';
        }
      });
      track.addEventListener('unmute', () => {
        if (session.mediaRecorder?.state === 'recording') {
          recordingStatus.textContent = microphoneStream ? 'Recording tab and microphone audio' : 'Recording tab audio';
        }
      });
    });
    recordingStatus.classList.add('recording');
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = false;
  } catch (error) {
    stopRecordingTracks();
    if (error.name === 'NotAllowedError') {
      recordingStatus.textContent = 'Recording cancelled or permission denied';
    } else {
      recordingStatus.textContent = 'Could not start recording';
    }
  }
}

function stopDemoRecording() {
  if (session.mediaRecorder?.state === 'recording') {
    stopRecordingBtn.disabled = true;
    recordingStatus.textContent = 'Finishing video…';
    session.mediaRecorder.stop();
  }
}

function renderQuickActions() {
  quickActionsEl.innerHTML = getSuggestedQuestions()
    .map((question) => `<button class="quick-pill" type="button">${escapeHtml(question)}</button>`)
    .join('');

  quickActionsEl.querySelectorAll('.quick-pill').forEach((button) => {
    button.addEventListener('click', () => {
      handleCustomerInput(button.textContent.trim());
    });
  });
}

function renderOrderHelper() {
  orderHelperEl.innerHTML = Object.values(mockOrders)
    .map((order) => `
      <div class="order-card">
        <h4>${order.order_id}</h4>
        <p class="order-meta"><strong>Customer:</strong> ${order.customer}</p>
        <p class="order-meta"><strong>Product:</strong> ${order.product}</p>
        <p class="order-meta"><strong>Value:</strong> ₹${order.value}</p>
        <p class="order-meta"><strong>Status:</strong> ${order.status}</p>
        <p class="order-meta"><strong>Notes:</strong> ${order.notes}</p>
      </div>
    `)
    .join('');
}

function renderTranscript() {
  transcriptEl.innerHTML = session.transcript
    .map((message) => `<div class="message ${message.role}">${escapeHtml(message.text)}</div>`)
    .join('');
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function updateSummary(summary) {
  session.summary = summary;
  summaryOutput.textContent = JSON.stringify(summary, null, 2);
}

function appendMessage(role, text) {
  session.transcript.push({ role, text });
  renderTranscript();
}

function stopRecognition() {
  const recognition = session.recognition;
  session.recognition = null;
  if (!recognition) return;
  try {
    recognition.stop();
  } catch (error) {
    // The recognition service may already have stopped.
  }
}

function resumeRecognition() {
  if (!session.active || session.assistantSpeaking || session.recognition) return;
  startRecognition();
}

function interruptAssistant() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  session.assistantSpeaking = false;
  interruptBtn.hidden = true;
  if (session.active) {
    setState('listening');
    resumeRecognition();
  } else {
    setState('idle');
  }
}

function speakText(text) {
  if (!('speechSynthesis' in window)) {
    if (session.active) {
      setState('listening');
      resumeRecognition();
    }
    return;
  }

  stopRecognition();
  session.assistantSpeaking = true;
  interruptBtn.hidden = false;
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const language = languageModeEl.value;
  const preferredVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2))) ||
    voices.find((voice) => language === 'hi-IN' ? /hindi/i.test(voice.name) : /india/i.test(voice.lang));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.lang = language;
  utterance.onstart = () => setState('speaking');
  utterance.onend = () => {
    session.assistantSpeaking = false;
    interruptBtn.hidden = true;
    setState(session.active ? 'listening' : 'idle');
    if (session.active) {
      resumeRecognition();
    }
  };
  utterance.onerror = () => {
    session.assistantSpeaking = false;
    interruptBtn.hidden = true;
    setState(session.active ? 'listening' : 'idle');
    if (session.active) {
      resumeRecognition();
    }
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function handleAssistantReply(inputText, contextualText = inputText) {
  const reply = generateAgentReply(contextualText, languageModeEl.value);
  const orderId = getOrderDetails(contextualText)?.order_id || detectOrderId(contextualText);
  const product = getProductDetails(contextualText);
  const intent = classifyIntent(contextualText);
  if (intent !== 'GENERAL_SUPPORT' && intent !== 'GREETING') session.lastIntent = intent;
  if (orderId && getOrderDetails(orderId)) session.lastOrderId = orderId;
  if (product) session.lastOrderId = product.sample_order_id;

  appendMessage('agent', reply);
  setState('speaking');
  speakText(reply);

  const waitingForClarification = isAwaitingClarification(reply);
  if (waitingForClarification) {
    session.pendingIntent = intent;
    session.pendingOrderId = orderId || product?.sample_order_id || session.pendingOrderId;
  } else if (intent !== 'GENERAL_SUPPORT' && intent !== 'GREETING') {
    session.pendingIntent = null;
    session.pendingOrderId = null;
  }

  if (orderId) {
    const order = getOrderDetails(orderId);
    if (order) {
      const nextSummary = buildSummary(
        session.transcript,
        intent,
        orderId,
        session.pendingIntent ? 'NEEDS_INFO' : 'RESOLVED',
        `Customer asked about ${order.product}. ${order.notes} Agent response: ${reply}`
      );
      updateSummary(nextSummary);
    }
  }

  if (reply.toLowerCase().includes('couldn’t locate an order') || reply.toLowerCase().includes('please share your order id') || /order id.*dobara/i.test(reply)) {
    const nextSummary = buildSummary(session.transcript, intent, orderId, 'NEEDS_INFO', 'Customer asked for order support but order details were missing or incorrect.');
    updateSummary(nextSummary);
  }
}

function handleCustomerInput(text) {
  const clean = String(text || '').trim();
  if (!clean) {
    return;
  }

  if ('speechSynthesis' in window) {
    interruptAssistant();
  }

  appendMessage('customer', clean);
  setState('thinking');
  const orderId = detectOrderId(clean);
  if (orderId && session.pendingIntent) session.pendingOrderId = orderId;
  const contextualText = contextualizeFollowUp(clean, session.pendingIntent, session.pendingOrderId, session.lastOrderId);
  handleAssistantReply(clean, contextualText);
}

function startRecognition() {
  if (!session.active || session.assistantSpeaking || session.recognition) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    manualInput.focus();
    setState('idle');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = languageModeEl.value;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    session.active = true;
    setState('listening');
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const recognizedText = result[0]?.transcript?.trim() || '';
      if (result.isFinal) {
        finalTranscript += `${recognizedText} `;
      }
    }

    if (finalTranscript.trim()) {
      handleCustomerInput(finalTranscript.trim());
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      session.active = false;
      setState('idle');
      appendMessage('agent', 'Microphone access is unavailable. You can continue using the manual input below.');
    }
  };

  recognition.onend = () => {
    if (session.recognition === recognition) session.recognition = null;
    if (session.active && !session.assistantSpeaking) {
      window.setTimeout(() => {
        resumeRecognition();
      }, 150);
    }
  };

  session.recognition = recognition;
  try {
    recognition.start();
  } catch (error) {
    if (session.recognition === recognition) session.recognition = null;
    setState('idle');
    manualInput.focus();
  }
}

function endCall() {
  session.active = false;
  stopRecognition();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  session.assistantSpeaking = false;
  interruptBtn.hidden = true;

  const summary = buildSummary(
    session.transcript,
    session.lastIntent,
    session.lastOrderId,
    session.pendingIntent ? 'NEEDS_INFO' : (session.transcript.some((msg) => msg.role === 'customer') ? 'RESOLVED' : 'NEEDS_INFO'),
    session.pendingIntent ? 'Call ended while waiting for customer clarification.' : null
  );

  stopTimer();
  setState('idle');
  appendMessage('agent', 'This call has ended. Your transcript and structured summary are ready.');
}

function resetSession() {
  session.transcript = [];
  session.pendingIntent = null;
  session.pendingOrderId = null;
  session.lastIntent = 'UNKNOWN';
  session.lastOrderId = null;
  session.active = true;
  renderTranscript();
  updateSummary({
    customer_intent: 'NONE',
    order_id: null,
    resolution_status: 'IN_PROGRESS',
    call_summary: 'Call started. Waiting for customer input.'
  });
  stopTimer();
  startTimer();
}

startCallBtn.addEventListener('click', () => {
  stopRecognition();
  resetSession();
  setState('listening');
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const greeting = generateAgentReply('hello', languageModeEl.value);
  appendMessage('agent', greeting);
  speakText(greeting);
});

endCallBtn.addEventListener('click', () => {
  endCall();
});

interruptBtn.addEventListener('click', () => {
  interruptAssistant();
});

fullscreenBtn.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    fullscreenBtn.textContent = 'Full screen unavailable';
    window.setTimeout(() => {
      fullscreenBtn.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    }, 1800);
  }
});

startRecordingBtn.addEventListener('click', startDemoRecording);
stopRecordingBtn.addEventListener('click', stopDemoRecording);

document.addEventListener('fullscreenchange', () => {
  const isFullscreen = Boolean(document.fullscreenElement);
  fullscreenBtn.textContent = isFullscreen ? 'Exit full screen' : 'Full screen';
  fullscreenBtn.setAttribute('aria-label', isFullscreen ? 'Exit full screen' : 'Enter full screen');
});

sendManualBtn.addEventListener('click', () => {
  const value = manualInput.value.trim();
  if (!value) {
    return;
  }
  handleCustomerInput(value);
  manualInput.value = '';
});

copySummaryBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(summaryOutput.textContent);
    copySummaryBtn.textContent = 'Copied';
    window.setTimeout(() => {
      copySummaryBtn.textContent = 'Copy summary';
    }, 1200);
  } catch (error) {
    copySummaryBtn.textContent = 'Copy failed';
  }
});

clearTranscriptBtn.addEventListener('click', () => {
  session.transcript = [];
  session.pendingIntent = null;
  session.pendingOrderId = null;
  session.lastIntent = 'UNKNOWN';
  session.lastOrderId = null;
  renderTranscript();
  updateSummary({
    customer_intent: 'NONE',
    order_id: null,
    resolution_status: 'IN_PROGRESS',
    call_summary: 'Transcript cleared. Ready for the next call.'
  });
});

languageModeEl.addEventListener('change', () => {
  if (session.active && session.recognition) {
    session.recognition.stop();
  }
});

manualInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    sendManualBtn.click();
  }
});

renderQuickActions();
renderOrderHelper();
updateSummary({
  customer_intent: 'NONE',
  order_id: null,
  resolution_status: 'IN_PROGRESS',
  call_summary: 'No call recorded yet.'
});
renderTranscript();
