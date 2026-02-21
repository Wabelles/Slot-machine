(() => {
  const symbols = ["🍒","🍋","🔔","💎","7️⃣","🍀"];

  const MODES = {
    normal: {
      name: "NORMAL",
      reelCount: 3,
      winChance: 0.18,
      status: "Pull the lever",
    },
    insane: {
      name: "INSANE",
      reelCount: 100,          
      winChance: 1 / 100000,   
      status: "INSANE MODE — good luck",
    }
  };

  let modeKey = "normal";

  const statusEl = document.getElementById("status");
  const overlay = document.getElementById("overlay");
  const spinAgain = document.getElementById("spinAgain");
  const coinsEl = document.getElementById("coins");
  const lever = document.getElementById("leverHandle");
  const reelsHost = document.getElementById("reels");
  const secretBtn = document.getElementById("secretBtn");

  let reels = [];  
  let strips = [];  
  let spinning = false;

  let audioCtx = null;
  const SFX = {
    ensure() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(()=>{});
    },
    beep({freq=440, dur=0.08, type="sine", gain=0.04} = {}) {
      if (!audioCtx) return;
      const t = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur);
    },
    noise({dur=0.12, gain=0.03} = {}) {
      if (!audioCtx) return;
      const t = audioCtx.currentTime;
      const bufferSize = Math.floor(audioCtx.sampleRate * dur);
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(g).connect(audioCtx.destination);
      src.start(t);
    },
    pull() { this.beep({freq:180, dur:0.07, type:"square", gain:0.05}); this.beep({freq:120, dur:0.07, type:"square", gain:0.05}); },
    spinStart() { this.noise({dur:0.18, gain:0.03}); this.beep({freq:520, dur:0.06, type:"sawtooth", gain:0.03}); },
    stop() { this.beep({freq:260, dur:0.06, type:"triangle", gain:0.05}); },
    win() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f,i)=> setTimeout(()=> this.beep({freq:f, dur:0.10, type:"sine", gain:0.05}), i*90));
      setTimeout(()=> this.noise({dur:0.20, gain:0.02}), 120);
    },
    coins() {
      for (let i=0;i<8;i++){
        setTimeout(()=> this.beep({freq:900 + Math.random()*400, dur:0.03, type:"triangle", gain:0.03}), i*30);
      }
    }
  };

  function setStatus(t){ statusEl.textContent = t; }
  function randSym(){ return symbols[Math.floor(Math.random()*symbols.length)]; }

  function renderReels(count){
    reelsHost.innerHTML = "";
    for (let i=0;i<count;i++){
      const reelEl = document.createElement("div");
      reelEl.className = "reel";
      reelEl.dataset.r = String(i);

      const stripEl = document.createElement("div");
      stripEl.className = "strip";
      reelEl.appendChild(stripEl);

      reelsHost.appendChild(reelEl);
    }
    reels = [...reelsHost.querySelectorAll(".reel")];
  }

  function reelCellHeight(reelEl) {
    return Math.round(reelEl.getBoundingClientRect().height);
  }

  function buildStrip(reelEl) {
    const strip = reelEl.querySelector(".strip");
    strip.innerHTML = "";
    const h = reelCellHeight(reelEl);
    const len = 20;
    for (let i=0;i<len;i++){
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.height = h + "px";
      cell.textContent = randSym();
      strip.appendChild(cell);
    }
    return { strip, len, h };
  }

  function rebuildAllStrips(){
    strips = reels.map(buildStrip);
  }

  function animateReel(strip, len, h, finalSym, durationMs) {
    strip.lastElementChild.textContent = finalSym;

    strip.style.transition = "none";
    strip.style.transform = "translateY(0px)";
    strip.getBoundingClientRect();

    const targetY = -h * (len - 1);
    strip.style.transition = `transform ${durationMs}ms cubic-bezier(.10,.80,.15,1)`;
    strip.style.transform = `translateY(${targetY}px)`;

    return new Promise(res => strip.addEventListener("transitionend", res, {once:true}));
  }

  function coinSpray() {
    const count = 90 + Math.floor(Math.random()*40);
    const reelsBox = reelsHost.getBoundingClientRect();
    const host = coinsEl.getBoundingClientRect();

    const ox = reelsBox.left - host.left + reelsBox.width * 0.55;
    const oy = reelsBox.top - host.top + reelsBox.height * 0.1;

    for (let i=0;i<count;i++){
      const c = document.createElement("div");
      c.className = "coin";
      c.style.left = ox + "px";
      c.style.top = oy + "px";
      coinsEl.appendChild(c);

      const angle = (-Math.PI/2) + (Math.random()*Math.PI/1.1) - (Math.PI/2.2);
      const speed = 5 + Math.random()*11;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const rot = (Math.random()*900 - 450);
      const life = 900 + Math.random()*700;
      const drift = (Math.random()*90 - 45);

      const anim = c.animate([
        { transform:`translate(0,0) rotate(0deg)`, opacity:1, offset:0 },
        { transform:`translate(${vx*28}px, ${vy*28}px) rotate(${rot*0.5}deg)`, opacity:1, offset:0.5 },
        { transform:`translate(${vx*44 + drift}px, ${vy*44 + 260}px) rotate(${rot}deg)`, opacity:0, offset:1 }
      ], { duration: life, easing:"cubic-bezier(.2,.7,.2,1)", fill:"forwards" });

      anim.onfinish = () => c.remove();
    }
  }

  function showOverlay(){ overlay.classList.add("show"); }
  function hideOverlay(){ overlay.classList.remove("show"); }

  function isWinAllSame(arr){
    for (let i=1;i<arr.length;i++) if (arr[i] !== arr[0]) return false;
    return true;
  }

  async function spin() {
    if (spinning) return;
    spinning = true;
    hideOverlay();

    const mode = MODES[modeKey];

    SFX.ensure();
    setStatus("Spinning…");
    SFX.spinStart();

    rebuildAllStrips();

    const finals = Array.from({length: mode.reelCount}, () => randSym());

    if (Math.random() < mode.winChance) {
      const forced = randSym();
      for (let i=0;i<finals.length;i++) finals[i] = forced;
    }

    if (modeKey === "normal") {
      await animateReel(strips[0].strip, strips[0].len, strips[0].h, finals[0], 900);
      SFX.stop();
      await animateReel(strips[1].strip, strips[1].len, strips[1].h, finals[1], 1050);
      SFX.stop();
      await animateReel(strips[2].strip, strips[2].len, strips[2].h, finals[2], 1200);
      SFX.stop();
    } else {
      const base = 520;
      const stagger = 8;

      const promises = reels.map((_, i) => {
        const dur = base + (i % 10) * 30;
        return new Promise(resolve => {
          setTimeout(() => {
            animateReel(strips[i].strip, strips[i].len, strips[i].h, finals[i], dur).then(resolve);
          }, i * stagger);
        });
      });

      await Promise.all(promises);
      SFX.stop();
    }

    const win = isWinAllSame(finals);

    if (win) {
      setStatus("JACKPOT! 🎰");
      SFX.win();
      SFX.coins();
      coinSpray();
      setTimeout(showOverlay, 280);
    } else {
      setStatus(modeKey === "insane" ? "No win" : "No win — pull again");
    }

    spinning = false;
  }

  const railTop = 58;
  function leverBounds(){
    const leverBox = document.querySelector(".lever").getBoundingClientRect();
    const handleH = lever.getBoundingClientRect().height || 36;
    const top = railTop;
    const bottom = Math.max(top, leverBox.height - 54 - handleH);
    return { top, bottom };
  }
  function setLeverTop(px){ lever.style.top = px + "px"; }
  function resetLever(){
    lever.style.transition = "top 220ms cubic-bezier(.2,.9,.2,1)";
    setLeverTop(railTop);
    setTimeout(()=> lever.style.transition="none", 260);
  }
  function pullPct(currentTop){
    const { top, bottom } = leverBounds();
    return bottom === top ? 0 : (currentTop - top) / (bottom - top);
  }

  let dragging=false, startY=0, startTop=railTop;
  const THRESH = 0.78;

  function onStart(y){
    if (spinning) return;
    SFX.ensure();
    SFX.pull();
    setStatus("Pull…");
    dragging=true;
    startY=y;
    startTop=parseFloat(getComputedStyle(lever).top)||railTop;
    lever.style.transition="none";
  }
  function onMove(y){
    if (!dragging) return;
    const dy = y - startY;
    const { top, bottom } = leverBounds();
    let next = startTop + dy;
    if (next < top) next = top;
    if (next > bottom) next = bottom;
    setLeverTop(next);
  }
  function onEnd(){
    if (!dragging) return;
    dragging=false;
    const currentTop = parseFloat(getComputedStyle(lever).top)||railTop;
    const pct = pullPct(currentTop);
    resetLever();
    if (pct >= THRESH) spin();
    else setStatus("Pull farther to spin");
  }

  lever.addEventListener("pointerdown", (e)=>{
    lever.setPointerCapture(e.pointerId);
    onStart(e.clientY);
  });
  lever.addEventListener("pointermove", (e)=> onMove(e.clientY));
  lever.addEventListener("pointerup", onEnd);
  lever.addEventListener("pointercancel", onEnd);

  lever.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" || e.key === " "){
      e.preventDefault();
      if (!spinning) spin();
    }
  });

  spinAgain.addEventListener("click", ()=>{
    hideOverlay();
    setStatus(MODES[modeKey].status);
  });

  function setMode(nextKey){
    if (spinning) return;
    modeKey = nextKey;

    const machine = document.querySelector(".machine");
    machine.classList.toggle("insane", modeKey === "insane");

    renderReels(MODES[modeKey].reelCount);
    rebuildAllStrips();

    hideOverlay();
    setLeverTop(railTop);
    setStatus(MODES[modeKey].status);
  }

  secretBtn.addEventListener("click", ()=>{
    setMode(modeKey === "normal" ? "insane" : "normal");
  });

  secretBtn.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" || e.key === " "){
      e.preventDefault();
      setMode(modeKey === "normal" ? "insane" : "normal");
    }
  });

  renderReels(MODES[modeKey].reelCount);
  rebuildAllStrips();
  setLeverTop(railTop);
  setStatus(MODES[modeKey].status);

})();
