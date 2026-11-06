// ============ Referências DOM ============
const textoEl = document.getElementById('texto');
const vozSelect = document.getElementById('voz');
const tomSlider = document.getElementById('tom');
const velSlider = document.getElementById('velocidade');
const volSlider = document.getElementById('volume');
const presetSelect = document.getElementById('preset');
const tomVal = document.getElementById('tomVal');
const velVal = document.getElementById('velVal');
const volVal = document.getElementById('volVal');
const charCount = document.getElementById('charCount');

const btnFalar = document.getElementById('btnFalar');
const btnPausar = document.getElementById('btnPausar');
const btnParar = document.getElementById('btnParar');
const btnGravar = document.getElementById('btnGravar');
const statusEl = document.getElementById('status');

const gravacaoDiv = document.getElementById('gravacao');
const audioPlayback = document.getElementById('audioPlayback');
const downloadLink = document.getElementById('downloadLink');

// ============ Estado ============
const synth = window.speechSynthesis;
let voices = [];
let utterance = null;
let gravando = false;
let mediaRecorder = null;
let chunksGravacao = [];
let streamCaptura = null;
let audioContextDest = null;

// ============ Carregar vozes ============
function carregarVozes() {
  voices = synth.getVoices();
  vozSelect.innerHTML = '';

  if (voices.length === 0) {
    vozSelect.innerHTML = '<option value="">Nenhuma voz disponível</option>';
    return;
  }

  // Agrupa por idioma (prioriza pt-BR, depois pt, depois outros)
  const ptVozes = voices.filter(v => v.lang.startsWith('pt'));
  const outrasVozes = voices.filter(v => !v.lang.startsWith('pt'));

  const addOption = (v, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    const genero = inferirGenero(v.name);
    opt.textContent = `${v.name} — ${v.lang}${genero ? ' · ' + genero : ''}`;
    vozSelect.appendChild(opt);
  };

  if (ptVozes.length > 0) {
    const grupoPT = document.createElement('optgroup');
    grupoPT.label = '🇧🇷 Português';
    ptVozes.forEach(v => {
      const opt = document.createElement('option');
      opt.value = voices.indexOf(v);
      const genero = inferirGenero(v.name);
      opt.textContent = `${v.name} — ${v.lang}${genero ? ' · ' + genero : ''}`;
      grupoPT.appendChild(opt);
    });
    vozSelect.appendChild(grupoPT);
  }

  if (outrasVozes.length > 0) {
    const grupoOutras = document.createElement('optgroup');
    grupoOutras.label = '🌍 Outros idiomas';
    outrasVozes.forEach(v => {
      const opt = document.createElement('option');
      opt.value = voices.indexOf(v);
      const genero = inferirGenero(v.name);
      opt.textContent = `${v.name} — ${v.lang}${genero ? ' · ' + genero : ''}`;
      grupoOutras.appendChild(opt);
    });
    vozSelect.appendChild(grupoOutras);
  }

  // Seleciona primeira voz pt-BR por padrão
  const primeiraPT = voices.findIndex(v => v.lang.startsWith('pt-BR'));
  if (primeiraPT >= 0) vozSelect.value = primeiraPT;
}

// Heurística simples para inferir gênero pelo nome da voz
function inferirGenero(nome) {
  const n = nome.toLowerCase();
  const femininos = ['female', 'fem', 'mulher', 'maria', 'ana', 'luciana', 'joana', 'helena', 'catarina', 'francisca', 'fernanda', 'monica', 'zira', 'samantha', 'karen', 'susan', 'victoria', 'google português do brasil'];
  const masculinos = ['male', 'masc', 'homem', 'joão', 'joao', 'daniel', 'david', 'mark', 'george', 'james', 'thiago', 'ricardo', 'antonio', 'paulo'];
  if (femininos.some(f => n.includes(f))) return '♀️ Feminino';
  if (masculinos.some(m => n.includes(m))) return '♂️ Masculino';
  return '';
}

// Garante carregamento assíncrono das vozes (Chrome)
synth.onvoiceschanged = carregarVozes;

// ============ Atualizar valores dos sliders ============
tomSlider.addEventListener('input', () => tomVal.textContent = parseFloat(tomSlider.value).toFixed(1));
velSlider.addEventListener('input', () => velVal.textContent = parseFloat(velSlider.value).toFixed(1));
volSlider.addEventListener('input', () => volVal.textContent = parseFloat(volSlider.value).toFixed(1));

// Contador de caracteres
function atualizarContador() {
  charCount.textContent = textoEl.value.length;
}
textoEl.addEventListener('input', atualizarContador);
atualizarContador();

// ============ Presets de voz ============
const presets = {
  narrador:  { tom: 1.0, vel: 0.9,  vol: 1.0 },
  animado:   { tom: 1.4, vel: 1.3,  vol: 1.0 },
  serio:     { tom: 0.7, vel: 0.8,  vol: 1.0 },
  sussurro:  { tom: 1.1, vel: 0.75, vol: 0.4 },
  noticia:   { tom: 0.95, vel: 1.15, vol: 1.0 },
  infantil:  { tom: 1.6, vel: 1.1,  vol: 1.0 }
};

presetSelect.addEventListener('change', () => {
  const p = presets[presetSelect.value];
  if (!p) return;
  tomSlider.value = p.tom;
  velSlider.value = p.vel;
  volSlider.value = p.vol;
  tomVal.textContent = p.tom.toFixed(1);
  velVal.textContent = p.vel.toFixed(1);
  volVal.textContent = p.vol.toFixed(1);
});

// ============ Configurar utterance ============
function criarUtterance() {
  const u = new SpeechSynthesisUtterance(textoEl.value);
  const vozIdx = parseInt(vozSelect.value, 10);
  if (!isNaN(vozIdx) && voices[vozIdx]) u.voice = voices[vozIdx];
  u.pitch = parseFloat(tomSlider.value);
  u.rate = parseFloat(velSlider.value);
  u.volume = parseFloat(volSlider.value);
  u.lang = u.voice ? u.voice.lang : 'pt-BR';
  return u;
}

// ============ Controles de fala ============
function falar() {
  if (!textoEl.value.trim()) {
    setStatus('⚠️ Digite algum texto primeiro.');
    return;
  }
  synth.cancel();
  utterance = criarUtterance();

  utterance.onstart = () => {
    setStatus('🔊 Falando...');
    btnPausar.disabled = false;
    btnParar.disabled = false;
    btnFalar.disabled = true;
  };
  utterance.onend = () => {
    setStatus('✅ Fala finalizada.');
    btnPausar.disabled = true;
    btnParar.disabled = true;
    btnFalar.disabled = false;
    btnPausar.textContent = '⏸️ Pausar';
    // Se estava gravando, finaliza
    if (gravando) pararGravacao();
  };
  utterance.onerror = (e) => {
    setStatus('❌ Erro na fala: ' + e.error);
    btnFalar.disabled = false;
    btnPausar.disabled = true;
    btnParar.disabled = true;
    if (gravando) pararGravacao();
  };

  synth.speak(utterance);
}

btnFalar.addEventListener('click', falar);

btnPausar.addEventListener('click', () => {
  if (synth.speaking && !synth.paused) {
    synth.pause();
    btnPausar.textContent = '⏵️ Retomar';
    setStatus('⏸️ Pausado.');
  } else if (synth.paused) {
    synth.resume();
    btnPausar.textContent = '⏸️ Pausar';
    setStatus('🔊 Falando...');
  }
});

btnParar.addEventListener('click', () => {
  synth.cancel();
  setStatus('⏹️ Parado.');
  btnPausar.disabled = true;
  btnParar.disabled = true;
  btnFalar.disabled = false;
  btnPausar.textContent = '⏸️ Pausar';
  if (gravando) pararGravacao();
});

// ============ Gravação ============
btnGravar.addEventListener('click', async () => {
  if (gravando) {
    pararGravacao();
    return;
  }
  if (!textoEl.value.trim()) {
    setStatus('⚠️ Digite algum texto antes de gravar.');
    return;
  }

  try {
    // Solicita captura de áudio da aba (obrigatório para capturar TTS)
    streamCaptura = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const audioTracks = streamCaptura.getAudioTracks();
    if (audioTracks.length === 0) {
      setStatus('⚠️ Você precisa marcar "Compartilhar áudio da aba".');
      streamCaptura.getTracks().forEach(t => t.stop());
      return;
    }

    // Cria MediaStream apenas com áudio
    const audioStream = new MediaStream(audioTracks);

    chunksGravacao = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

    mediaRecorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksGravacao.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksGravacao, { type: mediaRecorder.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      audioPlayback.src = url;
      downloadLink.href = url;
      downloadLink.download = `narracao_${Date.now()}.webm`;
      gravacaoDiv.classList.remove('hidden');
      setStatus('✅ Gravação concluída! Faça o download abaixo.');
    };

    mediaRecorder.start();

    // Usuário pode parar o compartilhamento manualmente
    audioTracks[0].onended = () => {
      if (gravando) pararGravacao();
    };

    gravando = true;
    btnGravar.classList.add('gravando');
    btnGravar.textContent = '⏹️ Parar Gravação';
    setStatus('🔴 Gravando... Falando o texto...');

    // Inicia a fala após pequeno delay para garantir que a gravação já começou
    setTimeout(falar, 400);

  } catch (err) {
    console.error(err);
    if (err.name === 'NotAllowedError') {
      setStatus('⚠️ Permissão de compartilhamento negada.');
    } else {
      setStatus('❌ Erro ao iniciar gravação: ' + err.message);
    }
    if (streamCaptura) {
      streamCaptura.getTracks().forEach(t => t.stop());
      streamCaptura = null;
    }
  }
});

function pararGravacao() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (e) { /* ignore */ }
  }
  if (streamCaptura) {
    streamCaptura.getTracks().forEach(t => t.stop());
    streamCaptura = null;
  }
  gravando = false;
  btnGravar.classList.remove('gravando');
  btnGravar.textContent = '🔴 Gravar';
  if (synth.speaking) synth.cancel();
}

// ============ Utilitário ============
function setStatus(msg) {
  statusEl.textContent = msg;
}

// ============ Inicialização ============
// Chrome precisa que getVoices seja chamado após um pequeno delay na 1ª vez
if (typeof speechSynthesis !== 'undefined') {
  carregarVozes();
  setTimeout(carregarVozes, 300);
}