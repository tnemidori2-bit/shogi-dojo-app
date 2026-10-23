import { T } from '../text.js';
import { state, ANIMALS, MAX_PROFILES, NAME_MAX, animalOf, emit } from '../core/store.js';
import { saveProfiles, saveSettings, removePersonData, buildExport, parseBackup, applyImport } from '../core/storage.js';
import { applyVolume, sfx } from '../core/audio.js';
import { escapeHtml } from './profile.js';
import { toast } from '../ui.js';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

export function mountAdult(root, nav) {
  const el = document.createElement('div');
  el.className = 'screen adult';
  let pickedIcon = ANIMALS[0].id;
  let armed = null; // 「けす」を1回押したプロフィール
  let importing = null; // 読み込む前に、確認を待っているデータ
  let backupMsg = '';

  function render() {
    const rows = state.profiles.map((p) => {
      const a = animalOf(p.icon);
      return `<div class="row"><span class="emoji">${a.emoji}</span><span class="grow">${escapeHtml(p.name || a.label)}</span>
        <button class="btn small danger" type="button" data-del="${p.id}">${armed === p.id ? T.removeConfirm : T.remove}</button></div>`;
    }).join('');
    const full = state.profiles.length >= MAX_PROFILES;
    el.innerHTML = `
      <div class="title">${T.adultTitle}</div>
      <section><div class="rows">${rows}</div>
        ${full ? `<p class="note">${T.maxProfiles}</p>` : `
        <div class="icons">${ANIMALS.map((a) => `<button type="button" class="icon ${a.id === pickedIcon ? 'on' : ''}" data-icon="${a.id}">${a.emoji}</button>`).join('')}</div>
        <div class="row"><input id="pname" type="text" maxlength="${NAME_MAX}" placeholder="${T.namePlaceholder}" autocomplete="off" />
        <button class="btn small" type="button" id="create">${T.create}</button></div>`}
      </section>
      <section>
        <label class="row"><span class="grow">${T.volume}</span><input id="vol" type="range" min="0" max="1" step="0.1" value="${state.settings.volume}" /></label>
        <div class="row"><span class="grow">${T.defaultDifficulty}</span>
          <button type="button" class="btn small ${state.settings.defaultDifficulty === 'normal' ? 'on' : ''}" data-diff="normal">${T.normal}</button>
          <button type="button" class="btn small ${state.settings.defaultDifficulty === 'hard' ? 'on' : ''}" data-diff="hard">${T.hard}</button></div>
      </section>
      <section>
        <div class="row"><span class="grow">${T.backupTitle}</span></div>
        <p class="note">${T.backupNote}</p>
        <p class="note">${T.backupLast(daysSinceExport())}</p>
        ${importing ? `<p class="note warn">${T.importAsk(importing.profiles.length)}</p>
          <div class="row"><button class="btn small danger" type="button" id="import-go">${T.importGo}</button><button class="btn small" type="button" id="import-cancel">${T.importCancel}</button></div>`
        : `<div class="row"><button class="btn small" type="button" id="export">${T.exportBtn}</button><button class="btn small" type="button" id="import">${T.importBtn}</button></div>`}
        ${backupMsg ? `<p class="note">${backupMsg}</p>` : ''}
        <input type="file" id="file" accept=".json,application/json" hidden />
      </section>
      <button class="btn" type="button" id="close">${T.close}</button>`;

    el.querySelectorAll('[data-icon]').forEach((b) => b.addEventListener('click', () => { pickedIcon = b.dataset.icon; sfx('select'); keepNameRender(); }));
    el.querySelector('#create')?.addEventListener('click', async () => {
      const name = el.querySelector('#pname').value.trim().slice(0, NAME_MAX);
      state.profiles.push({ id: newId(), icon: pickedIcon, name, lastPlayed: null });
      await saveProfiles(); sfx('ok'); armed = null; render();
    });
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.del;
      if (armed !== id) { armed = id; render(); return; }
      state.profiles = state.profiles.filter((p) => p.id !== id);
      await removePersonData(id); await saveProfiles(); armed = null; emit(); render();
    }));
    el.querySelector('#vol').addEventListener('input', (e) => { state.settings.volume = Number(e.target.value); applyVolume(); });
    el.querySelector('#vol').addEventListener('change', () => { saveSettings(); sfx('tap'); });
    el.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { state.settings.defaultDifficulty = b.dataset.diff; saveSettings(); sfx('tap'); render(); }));
    el.querySelector('#export')?.addEventListener('click', doExport);
    el.querySelector('#import')?.addEventListener('click', () => { sfx('tap'); el.querySelector('#file').click(); });
    el.querySelector('#file').addEventListener('change', onFile);
    el.querySelector('#import-cancel')?.addEventListener('click', () => { importing = null; backupMsg = ''; sfx('tap'); render(); });
    el.querySelector('#import-go')?.addEventListener('click', async () => {
      try { await applyImport(importing); sfx('clear'); toast(T.importDone); nav.profile(); }
      catch (e) { console.warn(e); importing = null; backupMsg = T.importFail; render(); }
    });
    el.querySelector('#close').addEventListener('click', () => { sfx('tap'); nav.profile(); });
  }
  function daysSinceExport() {
    const t = state.settings.lastExport;
    if (!t) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }
  async function doExport() {
    try {
      const data = await buildExport();
      const text = JSON.stringify(data, null, 1);
      const d = new Date();
      const name = `shogi-dojo-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e && e.name === 'AbortError') { render(); return; } throw e; }
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      sfx('ok'); backupMsg = T.exportDone; render();
    } catch (e) { console.warn(e); backupMsg = T.exportFail; render(); }
  }
  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let text = '';
    try { text = await f.text(); } catch { backupMsg = T.importFail; render(); return; }
    const r = parseBackup(text);
    if (!r.ok) { sfx('no'); backupMsg = T.importBad[r.reason] || T.importFail; render(); return; }
    importing = r.data; backupMsg = ''; sfx('select'); render();
  }
  function keepNameRender() {
    const v = el.querySelector('#pname')?.value || '';
    render();
    const inp = el.querySelector('#pname'); if (inp) inp.value = v;
  }
  render();
  root.appendChild(el);
  return () => el.remove();
}
