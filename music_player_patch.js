// ── MUSIC PLAYER PATCH ──
// Drop this script at the end of <body> (after the existing scripts).
// It replaces the seek logic and injects the redesigned player UI.

(function () {
  // ────────────────────────────────────────────
  // 1. INJECT NEW CSS
  // ────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── Boomplay-style Now Playing card ── */
    .bp-np-card {
      background: linear-gradient(160deg,#0a1f13 0%,#0d2b1a 55%,#102415 100%);
      border: 1px solid rgba(76,175,110,0.18);
      border-radius: 20px;
      padding: 22px 20px 18px;
      margin-bottom: 14px;
      position: relative;
      overflow: hidden;
    }
    .bp-np-card::before {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 180px; height: 180px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(76,175,110,0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    /* Album art */
    .bp-art-wrap {
      width: 110px; height: 110px;
      border-radius: 16px;
      background: linear-gradient(135deg,#0d2818,#1a3a26);
      border: 1px solid rgba(76,175,110,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 42px;
      margin: 0 auto 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 4px rgba(76,175,110,0.07);
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
    }
    .bp-art-spin {
      animation: bp-rotate 8s linear infinite;
      animation-play-state: paused;
    }
    .bp-art-spin.playing {
      animation-play-state: running;
    }
    @keyframes bp-rotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* Track info */
    .bp-track-info {
      text-align: center;
      margin-bottom: 14px;
    }
    .bp-track-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 3px;
    }
    .bp-track-artist {
      font-size: 12px;
      color: var(--text3);
    }

    /* ── THE SEEK BAR — redesigned from scratch ── */
    .bp-seek-wrap {
      margin: 0 0 6px;
      padding: 0 2px;
    }
    .bp-seek-track {
      position: relative;
      height: 4px;
      border-radius: 99px;
      background: rgba(255,255,255,0.12);
      cursor: pointer;
      /* expand tap area without changing visible height */
      padding: 10px 0;
      margin: -10px 0;
      box-sizing: content-box;
    }
    .bp-seek-track:hover .bp-seek-fill { background: var(--accent); }
    .bp-seek-fill {
      position: absolute;
      top: 10px; left: 0;
      height: 4px;
      border-radius: 99px;
      background: var(--accent3);
      width: 0%;
      pointer-events: none;
      transition: background 0.15s;
    }
    .bp-seek-thumb {
      position: absolute;
      top: 50%; left: 0%;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: #fff;
      transform: translate(-50%, calc(-50% + 10px));
      box-shadow: 0 1px 6px rgba(0,0,0,0.4);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s, transform 0.05s;
    }
    .bp-seek-track:hover .bp-seek-thumb,
    .bp-seek-track.dragging .bp-seek-thumb {
      opacity: 1;
    }
    .bp-seek-track.dragging .bp-seek-thumb {
      transform: translate(-50%, calc(-50% + 10px)) scale(1.25);
    }
    .bp-time-row {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
    }
    .bp-time {
      font-size: 10px;
      color: var(--text3);
      font-variant-numeric: tabular-nums;
    }

    /* Controls row */
    .bp-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 4px;
      margin-bottom: 14px;
    }
    .bp-ctrl-btn {
      background: none; border: none;
      color: var(--text2); cursor: pointer;
      padding: 8px; border-radius: 10px;
      font-size: 20px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .bp-ctrl-btn:hover { color: var(--text); background: rgba(255,255,255,0.07); }
    .bp-ctrl-btn.active-ctrl { color: var(--accent3); }
    .bp-play-btn {
      width: 52px; height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent2), var(--accent));
      color: #fff;
      font-size: 22px;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 18px rgba(76,175,110,0.4);
      transition: all 0.15s;
      flex-shrink: 0;
    }
    .bp-play-btn:hover { transform: scale(1.06); box-shadow: 0 6px 22px rgba(76,175,110,0.55); }
    .bp-play-btn:active { transform: scale(0.96); }

    /* Volume */
    .bp-vol-row {
      display: flex; align-items: center; gap: 8px;
      padding: 0 2px; margin-bottom: 10px;
    }
    .bp-vol-icon { font-size: 14px; color: var(--text3); flex-shrink: 0; }

    /* Mini player — matching style */
    .mini-player {
      border-radius: 16px !important;
      background: linear-gradient(135deg,#0d2818,#152d1c) !important;
    }

    /* Track rows — cleaner */
    .track-row { border-radius: 10px !important; }
    .track-row.playing { background: rgba(76,175,110,0.09) !important; }

    /* Mobile: stack layout */
    @media (max-width: 768px) {
      .bp-art-wrap { width: 130px; height: 130px; font-size: 52px; }
      .bp-track-title { font-size: 16px; }
      .bp-np-card { padding: 24px 18px 18px; }
      .bp-play-btn { width: 58px; height: 58px; font-size: 24px; }
    }
  `;
  document.head.appendChild(style);

  // ────────────────────────────────────────────
  // 2. REPLACE NOW PLAYING CARD HTML
  // ────────────────────────────────────────────
  const npCard = document.querySelector('.np-card');
  if (npCard) {
    npCard.outerHTML = `
      <div class="bp-np-card" id="bp-np-card">
        <div class="bp-art-wrap">
          <div class="bp-art-spin" id="bp-art">🎵</div>
        </div>
        <div class="bp-track-info">
          <div class="bp-track-title" id="bp-title">No track selected</div>
          <div class="bp-track-artist" id="bp-artist">—</div>
        </div>

        <!-- SEEK BAR -->
        <div class="bp-seek-wrap">
          <div class="bp-seek-track" id="bp-seek-track">
            <div class="bp-seek-fill"  id="bp-seek-fill"></div>
            <div class="bp-seek-thumb" id="bp-seek-thumb"></div>
          </div>
          <div class="bp-time-row">
            <span class="bp-time" id="bp-cur">0:00</span>
            <span class="bp-time" id="bp-dur">0:00</span>
          </div>
        </div>

        <!-- CONTROLS -->
        <div class="bp-controls">
          <button class="bp-ctrl-btn" id="bp-shuffle-btn" onclick="toggleShuffle()" title="Shuffle">
            <i class="ti ti-arrows-shuffle"></i>
          </button>
          <button class="bp-ctrl-btn" onclick="prevTrack()">
            <i class="ti ti-player-skip-back-filled"></i>
          </button>
          <button class="bp-play-btn" id="bp-play-btn" onclick="togglePlay()">
            <i class="ti ti-player-play-filled" id="bp-play-icon"></i>
          </button>
          <button class="bp-ctrl-btn" onclick="nextTrack()">
            <i class="ti ti-player-skip-forward-filled"></i>
          </button>
          <button class="bp-ctrl-btn" id="bp-repeat-btn" onclick="cycleRepeat()" title="Repeat">
            <i class="ti ti-repeat" id="bp-repeat-icon"></i>
          </button>
        </div>

        <!-- VOLUME -->
        <div class="bp-vol-row">
          <i class="ti ti-volume bp-vol-icon"></i>
          <input type="range" id="bp-vol"
            min="0" max="100" value="80"
            oninput="setVolume(this.value)"
            style="flex:1;accent-color:var(--accent3)">
        </div>

        <!-- SLEEP TIMER -->
        <div class="sleep-timer-row">
          <i class="ti ti-moon"></i>
          <span>Sleep:</span>
          <select id="sleep-select" onchange="setSleepTimer(this.value)" style="flex:1">
            <option value="0">Off</option>
            <option value="10">10 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
          </select>
          <span id="sleep-countdown" class="sleep-timer-active" style="display:none"></span>
        </div>
      </div>`;
  }

  // ────────────────────────────────────────────
  // 3. WIRE UP THE NEW SEEK BAR (the real fix)
  // ────────────────────────────────────────────
  const audio = document.getElementById('global-audio');

  function bpFmt(s) {
    if (!s || isNaN(s) || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }

  // Central seek position setter — updates fill + thumb + time labels
  function bpSetPos(pct) {
    pct = Math.min(100, Math.max(0, pct));
    const fill  = document.getElementById('bp-seek-fill');
    const thumb = document.getElementById('bp-seek-thumb');
    if (fill)  fill.style.width = pct + '%';
    if (thumb) thumb.style.left = pct + '%';

    // Also sync mini player seek bar
    const mpBar = document.getElementById('mp-seek-bar');
    if (mpBar) {
      mpBar.value = pct;
      mpBar.style.setProperty('--pct', pct.toFixed(2) + '%');
    }
  }

  // Called by the legacy onTimeUpdate — only update UI if NOT dragging
  let _bpSeeking = false;

  // Override the existing onTimeUpdate to drive our new UI too
  const _origTimeUpdate = audio.ontimeupdate;
  audio.addEventListener('timeupdate', function () {
    if (_bpSeeking || !audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    bpSetPos(pct);

    const cur = bpFmt(audio.currentTime);
    const dur = bpFmt(audio.duration);
    const c1 = document.getElementById('bp-cur'); if (c1) c1.textContent = cur;
    const d1 = document.getElementById('bp-dur'); if (d1) d1.textContent = dur;

    // Keep mini player times in sync
    const mc = document.getElementById('mp-cur-time'); if (mc) mc.textContent = cur;
    const md = document.getElementById('mp-dur-time'); if (md) md.textContent = dur;

    // Spin the art disc
    const art = document.getElementById('bp-art');
    if (art) art.classList.toggle('playing', !audio.paused);
  });

  // ── Seek track interaction ──
  const seekTrack = document.getElementById('bp-seek-track');
  if (seekTrack) {
    function pctFromEvent(e) {
      const rect = seekTrack.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    }

    function commitSeek(pct) {
      if (audio.duration && isFinite(audio.duration)) {
        audio.currentTime = (pct / 100) * audio.duration;
      }
      _bpSeeking = false;
      seekTrack.classList.remove('dragging');
    }

    // Mouse
    seekTrack.addEventListener('mousedown', function (e) {
      e.preventDefault();
      _bpSeeking = true;
      seekTrack.classList.add('dragging');
      const pct = pctFromEvent(e);
      bpSetPos(pct);
      // Update time display live while pressing
      if (audio.duration) {
        const t = (pct / 100) * audio.duration;
        const c = document.getElementById('bp-cur'); if (c) c.textContent = bpFmt(t);
      }

      function onMove(ev) {
        const p = pctFromEvent(ev);
        bpSetPos(p);
        if (audio.duration) {
          const t = (p / 100) * audio.duration;
          const c = document.getElementById('bp-cur'); if (c) c.textContent = bpFmt(t);
        }
      }
      function onUp(ev) {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        commitSeek(pctFromEvent(ev));
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    // Touch
    seekTrack.addEventListener('touchstart', function (e) {
      e.preventDefault(); // stop page scroll while seeking
      _bpSeeking = true;
      seekTrack.classList.add('dragging');
      bpSetPos(pctFromEvent(e));
    }, { passive: false });

    seekTrack.addEventListener('touchmove', function (e) {
      e.preventDefault();
      const p = pctFromEvent(e);
      bpSetPos(p);
      if (audio.duration) {
        const t = (p / 100) * audio.duration;
        const c = document.getElementById('bp-cur'); if (c) c.textContent = bpFmt(t);
      }
    }, { passive: false });

    seekTrack.addEventListener('touchend', function (e) {
      const p = pctFromEvent(e.changedTouches[0] ? { clientX: e.changedTouches[0].clientX, touches: null } : e);
      const rect = seekTrack.getBoundingClientRect();
      const clientX = e.changedTouches[0].clientX;
      const finalPct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      commitSeek(finalPct);
    }, { passive: true });
  }

  // ── Also fix legacy mini-player seek bar (mp-seek-bar) ──
  const mpBar = document.getElementById('mp-seek-bar');
  if (mpBar) {
    // Remove old oninput to prevent double-firing
    mpBar.removeAttribute('oninput');
    let _mpDragging = false;

    mpBar.addEventListener('mousedown', () => { _bpSeeking = true; _mpDragging = true; });
    mpBar.addEventListener('touchstart', () => { _bpSeeking = true; _mpDragging = true; }, { passive: true });

    function mpCommit() {
      if (_mpDragging && audio.duration) {
        audio.currentTime = (parseFloat(mpBar.value) / 100) * audio.duration;
      }
      _mpDragging = false;
      _bpSeeking = false;
    }
    mpBar.addEventListener('mouseup', mpCommit);
    mpBar.addEventListener('touchend', mpCommit, { passive: true });
    mpBar.addEventListener('input', function () {
      const pct = parseFloat(this.value);
      mpBar.style.setProperty('--pct', pct.toFixed(2) + '%');
      bpSetPos(pct); // keep NP card in sync while dragging mini player
      if (audio.duration) {
        const t = (pct / 100) * audio.duration;
        const c = document.getElementById('mp-cur-time'); if (c) c.textContent = bpFmt(t);
        const c2 = document.getElementById('bp-cur'); if (c2) c2.textContent = bpFmt(t);
      }
    });
  }

  // Also remove oninput from the legacy np-seek range (it's been replaced)
  const npSeek = document.getElementById('np-seek');
  if (npSeek) npSeek.style.display = 'none'; // hidden but kept so existing code won't error

  // ────────────────────────────────────────────
  // 4. PATCH updateNowPlayingUI to update new elements
  // ────────────────────────────────────────────
  const _origUpdateNP = window.updateNowPlayingUI;
  window.updateNowPlayingUI = function (track) {
    _origUpdateNP && _origUpdateNP(track);
    const t = document.getElementById('bp-title');   if (t) t.textContent = track ? track.title : 'No track selected';
    const a = document.getElementById('bp-artist');  if (a) a.textContent = track ? track.artist : '—';
    bpSetPos(0);
    const cur = document.getElementById('bp-cur'); if (cur) cur.textContent = '0:00';
    const dur = document.getElementById('bp-dur'); if (dur) dur.textContent = track && track.duration ? bpFmt(track.duration) : '0:00';
  };

  // ────────────────────────────────────────────
  // 5. PATCH updatePlayIcons to cover new elements
  // ────────────────────────────────────────────
  const _origPlayIcons = window.updatePlayIcons;
  window.updatePlayIcons = function () {
    _origPlayIcons && _origPlayIcons();
    const playing = !audio.paused && !!audio.src;
    const icon = document.getElementById('bp-play-icon');
    if (icon) icon.className = playing ? 'ti ti-player-pause-filled' : 'ti ti-player-play-filled';
    const art = document.getElementById('bp-art');
    if (art) art.classList.toggle('playing', playing);
  };

  // ────────────────────────────────────────────
  // 6. PATCH updateShuffleUI / updateRepeatUI
  // ────────────────────────────────────────────
  const _origShuffle = window.updateShuffleUI;
  window.updateShuffleUI = function () {
    _origShuffle && _origShuffle();
    const btn = document.getElementById('bp-shuffle-btn');
    if (btn) btn.classList.toggle('active-ctrl', !!(window.state && window.state.music && window.state.music.shuffle));
  };

  const _origRepeat = window.updateRepeatUI;
  window.updateRepeatUI = function () {
    _origRepeat && _origRepeat();
    const btn  = document.getElementById('bp-repeat-btn');
    const icon = document.getElementById('bp-repeat-icon');
    if (!btn || !icon) return;
    const mode = window.state && window.state.music ? window.state.music.repeat : 'off';
    btn.classList.toggle('active-ctrl', mode !== 'off');
    icon.className = mode === 'one' ? 'ti ti-repeat-once' : 'ti ti-repeat';
  };

  // ────────────────────────────────────────────
  // 7. PATCH setVolume to drive new vol slider
  // ────────────────────────────────────────────
  const _origVol = window.setVolume;
  window.setVolume = function (val) {
    _origVol && _origVol(val);
    const bpVol = document.getElementById('bp-vol');
    if (bpVol) bpVol.value = val;
  };

  // ────────────────────────────────────────────
  // 8. Init state on load
  // ────────────────────────────────────────────
  (function init() {
    if (window.state && window.state.music) {
      const bpVol = document.getElementById('bp-vol');
      if (bpVol) bpVol.value = (window.state.music.volume || 0.8) * 100;
    }
    window.updatePlayIcons && window.updatePlayIcons();
    window.updateShuffleUI && window.updateShuffleUI();
    window.updateRepeatUI && window.updateRepeatUI();
  })();

})();
