(() => {
  const KEY = 'waage-web-v1';
  const defaults = {
    waagen: [
      { name: 'W1', percent: 80, current: 34 },
      { name: 'W2', percent: 5, current: 20 },
      { name: 'W3', percent: 15, current: 33 },
      { name: 'W4', percent: 0, current: 0 }
    ],
    selectedIndex: 0,
    tragerIndex: 0,
    extruderRate: 750,
    totalTrager: 0,
    durchsatz: 0,
    reserve: 450
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (!saved || !Array.isArray(saved.waagen) || !saved.waagen.length) return structuredClone(defaults);
      return { ...structuredClone(defaults), ...saved };
    } catch { return structuredClone(defaults); }
  }

  let state = load();
  if (!state.waagen[state.selectedIndex]) state.selectedIndex = 0;
  if (!state.waagen[state.tragerIndex]) state.tragerIndex = 0;
  if (![450, 90].includes(Number(state.reserve))) state.reserve = 450;

  const $ = id => document.getElementById(id);
  const parseDE = value => {
    const s = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => Number.isFinite(value)
    ? value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
  const inputFmt = value => Number(value || 0).toLocaleString('de-DE', { maximumFractionDigits: 3, useGrouping: false });
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  function totalPossible() {
    const w = state.waagen[state.selectedIndex];
    return w && w.percent > 0 ? w.current / (w.percent / 100) : 0;
  }
  function soll(i) { return totalPossible() * (state.waagen[i].percent / 100); }
  function diff(i) { return state.waagen[i].current - soll(i); }
  function restTimeMinutes() {
    const w = state.waagen[state.selectedIndex];
    if (!w || state.extruderRate <= 0 || w.percent <= 0) return 0;
    const rate = state.extruderRate * (w.percent / 100);
    return (w.current / rate) * 60;
  }
  function tragerTimeHours() {
    const w = state.waagen[state.tragerIndex];
    if (!w || state.extruderRate <= 0 || w.percent <= 0) return 0;
    const rate = state.extruderRate * (w.percent / 100);
    const restMaterial = state.totalTrager - state.durchsatz - w.current - state.reserve;
    return Math.max(0, restMaterial / rate);
  }

  function makeInput(value, onValue, className='input') {
    const input = document.createElement('input');
    input.className = className;
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.value = inputFmt(value);
    input.addEventListener('input', () => { onValue(parseDE(input.value)); save(); updateOutputs(); });
    input.addEventListener('blur', () => { input.value = inputFmt(parseDE(input.value)); });
    return input;
  }

  function renderRows() {
    const root = $('waagenRows'); root.innerHTML = '';
    state.waagen.forEach((w, i) => {
      const row = document.createElement('div'); row.className = 'waagen-grid waagen-row';
      const radio = document.createElement('button');
      radio.type = 'button'; radio.className = 'radio' + (i === state.selectedIndex ? ' selected' : '');
      radio.setAttribute('aria-label', `${w.name} als Hauptwaage wählen`);
      radio.addEventListener('click', () => { state.selectedIndex = i; save(); render(); });
      const name = document.createElement('div'); name.className = 'waage-name'; name.textContent = w.name;
      const p = makeInput(w.percent, v => state.waagen[i].percent = v);
      const c = makeInput(w.current, v => state.waagen[i].current = v);
      const s = document.createElement('div'); s.className = 'soll'; s.id = `soll-${i}`;
      row.append(radio, name, p, c, s); root.appendChild(row);
    });
  }

  function renderTragerPicker() {
    const root = $('tragerPicker'); root.innerHTML = '';
    state.waagen.forEach((w, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = w.name;
      if (i === state.tragerIndex) b.classList.add('selected');
      b.addEventListener('click', () => { state.tragerIndex = i; save(); renderTragerPicker(); updateOutputs(); });
      root.appendChild(b);
    });
  }

  function updateOutputs() {
    $('hauptwaage').textContent = `Hauptwaage: ${state.waagen[state.selectedIndex].name}`;
    const rest = restTimeMinutes();
    $('restzeit').textContent = `Restzeit: ${fmt(rest)} min`;
    $('restzeit').style.color = rest < 10 ? 'var(--red)' : 'var(--orange)';
    state.waagen.forEach((_, i) => {
      const d = diff(i), el = $(`soll-${i}`); if (!el) return;
      el.textContent = `${d >= 0 ? '+' : ''}${fmt(d)}`;
      el.className = `soll ${d < 0 ? 'negative' : 'positive'}`;
    });
    const hours = tragerTimeHours();
    const abschaltZeit = new Date(Date.now() + hours * 60 * 60 * 1000);
    const zeitText = abschaltZeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    $('abschalten').textContent = `Abschalten um: ${zeitText} Uhr`;
    $('abschalten').style.color = hours < 1 ? 'var(--red)' : 'var(--green)';
  }

  function renderReserve() {
    document.querySelectorAll('#reservePicker button').forEach(b => {
      b.classList.toggle('selected', Number(b.dataset.reserve) === Number(state.reserve));
    });
  }

  function render() {
    $('extruderRate').value = inputFmt(state.extruderRate);
    $('totalTrager').value = inputFmt(state.totalTrager);
    $('durchsatz').value = inputFmt(state.durchsatz);
    renderRows(); renderTragerPicker(); renderReserve(); updateOutputs();
  }

  $('extruderRate').addEventListener('input', e => { state.extruderRate = parseDE(e.target.value); save(); updateOutputs(); });
  $('totalTrager').addEventListener('input', e => { state.totalTrager = parseDE(e.target.value); save(); updateOutputs(); });
  $('durchsatz').addEventListener('input', e => { state.durchsatz = parseDE(e.target.value); save(); updateOutputs(); });
  ['extruderRate','totalTrager','durchsatz'].forEach(id => $(id).addEventListener('blur', e => e.target.value = inputFmt(parseDE(e.target.value))));
  document.querySelectorAll('#reservePicker button').forEach(b => b.addEventListener('click', () => {
    state.reserve = Number(b.dataset.reserve); save(); renderReserve(); updateOutputs();
  }));

  // Tap on empty space closes the iPhone keyboard, like the SwiftUI version.
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('input,button')) document.activeElement?.blur();
  });

  render();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
