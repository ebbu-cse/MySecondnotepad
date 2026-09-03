const $ = id => document.getElementById(id);
const STORAGE_KEY = "MyNotesApp_Data_v3";
const LEGACY_KEY = "MyNotesApp_Offline_Data_v1";

function safeParse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
function createDefaultData() {
  return { notes: [], playlists: [], settings: { theme: "green", darkMode: false } };
}
function loadData() {
  const current = safeParse(localStorage.getItem(STORAGE_KEY), null);
  if (current && Array.isArray(current.notes) && Array.isArray(current.playlists)) {
    current.settings ||= { theme: "green", darkMode: false };
    return current;
  }
  const legacy = safeParse(localStorage.getItem(LEGACY_KEY), null);
  if (legacy && Array.isArray(legacy.notes) && Array.isArray(legacy.playlists)) {
    return { ...legacy, settings: { theme: localStorage.getItem("theme") || "green", darkMode: localStorage.getItem("darkMode") === "true" } };
  }
  return createDefaultData();
}
let data = loadData();
let notes = data.notes;
let playlists = data.playlists;
let editingId = null;
let longPressNoteId = null;
let pressTimer = null;
let pressTriggered = false;
notes.forEach(n => { if (typeof n.hidden !== "boolean") n.hidden = false; });

function saveData() {
  data.notes = notes;
  data.playlists = playlists;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function id() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c])); }
function showModal(name) { $(name).classList.add("show"); }
function hideModal(name) { $(name).classList.remove("show"); if (name === "noteModal") $("playlistDropdown").classList.remove("show"); }

function render() {
  // Always show every saved note when the search bar is empty.
  const searchBox = $("searchInput");
  const q = searchBox ? String(searchBox.value || "").trim().toLowerCase() : "";
  const filtered = [...notes].filter(n => {
    // Hidden notes must never appear in normal Notes or search results.
    if (n && n.hidden === true) return false;
    if (!q) return true;
    const searchable = `${n.title || ""} ${n.tags || ""} ${n.content || ""}`.toLowerCase();
    return searchable.includes(q);
  })
    .sort((a,b) => Number(b.pinned)-Number(a.pinned) || (b.updated||0)-(a.updated||0));
  $("noteCount").textContent = `${filtered.length} note(s)`;
  $("notesList").innerHTML = filtered.length ? filtered.map(n => `
    <article class="note-card ${n.pinned ? "pinned" : ""}" data-note="${n.id}">
      <span class="badge">${n.favorite ? "⭐ " : ""}${n.pinned ? "📌" : ""}</span>
      <h3>${escapeHtml(n.title || "Untitled")}</h3>
      <p>${escapeHtml(n.content || "Empty note").slice(0,130)}</p>
      <div class="note-meta">${escapeHtml(n.tags || "No tags")}</div>
    </article>`).join("") : `<div class="empty">No notes found. Create your first note!</div>`;

  $("playlists").innerHTML = playlists.length ? playlists.map(p => {
    const icon = playlistIcon(p.name);
    const count = playlistNotes(p).length;
    return `<div class="playlist-card" data-playlist="${p.id}" role="button" tabindex="0">
      <div class="playlist-icon">${icon}</div>
      <div class="playlist-info"><h3>${escapeHtml(p.name)}</h3><p>${count} note(s)</p></div>
    </div>`;
  }).join("") : `<div class="empty">No playlists yet.</div>`;

  $("sidebarPlaylists").innerHTML = playlists.map(p => `
    <button class="menu-item" data-playlist="${p.id}">${playlistIcon(p.name)} ${escapeHtml(p.name)}</button>`).join("");
  saveData();
}
function playlistIcon(name) {
  if (name === "Favorites") return "⭐";
  if (name === "Pinned") return "📌";
  return "🎵";
}
function playlistNotes(p) {
  if (!p) return [];
  // Special playlists are calculated from the actual note status, so old saved IDs cannot break them.
  if (p.name === "Favorites") return notes.filter(n => n.hidden !== true && n.favorite === true);
  if (p.name === "Pinned") return notes.filter(n => n.hidden !== true && n.pinned === true);
  const ids = Array.isArray(p.notes) ? p.notes.map(String) : [];
  return notes.filter(n => n.hidden !== true && ids.includes(String(n.id)));
}


function renderHiddenNotes() {
  const container = $("hiddenNotesList");
  const hidden = notes.filter(n => n && n.hidden === true);
  if (!hidden.length) {
    container.innerHTML = `<div class="empty">No hidden notes.</div>`;
    return;
  }
  container.innerHTML = hidden.map(n => `
    <article class="note-card hidden-note-card" data-hidden-note="${n.id}">
      <h3>${escapeHtml(n.title || "Untitled")}</h3>
      <p>${escapeHtml(n.content || "Empty note").slice(0,130)}</p>
      <div class="note-meta">${escapeHtml(n.tags || "No tags")}</div>
    </article>`).join("");
}

function openHiddenNotes() {
  closeMenu();
  renderHiddenNotes();
  showModal("hiddenNotesModal");
}

function hideNote(noteId) {
  const targetId = String(noteId);
  const note = notes.find(n => n && String(n.id) === targetId);

  if (!note) {
    console.error("Hide failed: note not found", targetId);
    return;
  }

  // 1. Change the note data.
  note.hidden = true;
  note.updated = Date.now();

  // 2. Persist immediately.
  saveData();

  // 3. Remove the visible card immediately, even before a full re-render.
  document.querySelectorAll(`[data-note="${CSS.escape(targetId)}"]`).forEach(card => card.remove());

  // 4. Close menus and refresh all normal visible sections.
  longPressNoteId = null;
  hideModal("longPressMenu");
  hideModal("noteModal");
  render();
}
function unhideNote(noteId) {
  const n = notes.find(x => x && String(x.id) === String(noteId));
  if (!n) return;
  n.hidden = false;
  n.updated = Date.now();
  saveData();
  renderHiddenNotes();
  render();
}
function exportSingleNote(noteId) {
  const n = notes.find(x => x.id === noteId);
  if (!n) return;
  const text = `${n.title || "Untitled"}\n\nTags: ${n.tags || "None"}\n\n${n.content || ""}`;
  const blob = new Blob([text], {type:"text/plain"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(n.title || "note").replace(/[\\/:*?"<>|]/g, "_")}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function openLongPressMenu(noteId) {
  longPressNoteId = noteId;
  showModal("longPressMenu");
}
function runLongPressAction(action) {
  const noteId = longPressNoteId;
  if (!noteId) return;
  const n = notes.find(x => x.id === noteId);
  if (!n) return;
  if (action === "edit") {
    hideModal("longPressMenu");
    openNote(noteId);
  } else if (action === "export") {
    exportSingleNote(noteId);
    hideModal("longPressMenu");
  } else if (action === "hide") {
    // Hide immediately and stop the menu click from reopening the note.
    hideNote(noteId);
    return;
  } else if (action === "pin") {
    n.pinned = !n.pinned;
    toggleSpecial(n.id, "Pinned", n.pinned);
    saveData();
    render();
    hideModal("longPressMenu");
  }
}

function getSpecial(name) {
  let p = playlists.find(x => x.name === name);
  if (!p) { p = { id: id(), name, notes: [] }; playlists.unshift(p); }
  return p;
}
function toggleSpecial(noteId, name, enabled) {
  const p = getSpecial(name);
  p.notes = enabled ? [...new Set([...p.notes, noteId])] : p.notes.filter(x => x !== noteId);
  if (!enabled && !p.notes.length) playlists = playlists.filter(x => x !== p);
}

function openNewNote() {
  editingId = null;
  $("editorHeading").textContent = "Create Note";
  $("noteTitle").value = ""; $("noteTags").value = ""; $("noteContent").value = "";
  $("favoriteBtn").textContent = "☆ Favorite"; $("pinBtn").textContent = "📌 Pin";
  showModal("noteModal");
}
function openNote(noteId) {
  const n = notes.find(x => x.id === noteId); if (!n) return;
  editingId = noteId;
  $("editorHeading").textContent = "Edit Note";
  $("noteTitle").value = n.title || ""; $("noteTags").value = n.tags || ""; $("noteContent").value = n.content || "";
  $("favoriteBtn").textContent = n.favorite ? "⭐ Favorite" : "☆ Favorite";
  $("pinBtn").textContent = n.pinned ? "📌 Unpin" : "📌 Pin";
  showModal("noteModal");
}
function saveCurrentNote() {
  let n = editingId ? notes.find(x => x.id === editingId) : null;
  if (!n) { n = { id: id(), favorite:false, pinned:false, hidden:false, created:Date.now() }; notes.unshift(n); editingId = n.id; }
  n.title = $("noteTitle").value.trim() || "Untitled";
  n.tags = $("noteTags").value.trim(); n.content = $("noteContent").value; n.updated = Date.now();
  saveData(); $("saveStatus").textContent = "Saved ✓"; render();
  setTimeout(() => $("saveStatus").textContent = "", 1000);
}
function toggleFavorite() {
  if (!editingId) { alert("Save the note first."); return; }
  const n = notes.find(x => x.id === editingId); n.favorite = !n.favorite;
  toggleSpecial(n.id, "Favorites", n.favorite);
  $("favoriteBtn").textContent = n.favorite ? "⭐ Favorite" : "☆ Favorite"; saveData(); render();
}
function togglePin() {
  if (!editingId) { alert("Save the note first."); return; }
  const n = notes.find(x => x.id === editingId); n.pinned = !n.pinned;
  toggleSpecial(n.id, "Pinned", n.pinned);
  $("pinBtn").textContent = n.pinned ? "📌 Unpin" : "📌 Pin"; saveData(); render();
}
function openPlaylistModal() {
  $("playlistName").value = "";
  $("playlistNoteSelector").innerHTML = notes.length ? notes.map(n => `<label class="selector-item"><input type="checkbox" value="${n.id}"> ${escapeHtml(n.title)}</label>`).join("") : `<div class="empty">Create notes first.</div>`;
  showModal("playlistModal");
}
function savePlaylist() {
  const name = $("playlistName").value.trim();
  if (!name) { alert("Enter a playlist name."); return; }
  if (playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) { alert("A playlist with this name already exists."); return; }
  const selected = [...$("playlistNoteSelector").querySelectorAll("input:checked")].map(x => x.value);
  playlists.push({ id:id(), name, notes:selected });
  saveData(); render(); hideModal("playlistModal");
}
function viewPlaylist(pid) {
  const p = playlists.find(x => String(x.id) === String(pid)); if (!p) return;
  $("playlistViewTitle").textContent = playlistIcon(p.name) + " " + p.name;
  const ns = playlistNotes(p);
  $("playlistViewNotes").innerHTML = ns.length ? ns.map(n => `<article class="note-card" data-note="${n.id}"><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.content).slice(0,120)}</p></article>`).join("") : `<div class="empty">No notes in this playlist.</div>`;
  showModal("playlistViewModal");
}
function openPlaylistDropdown() {
  if (!editingId) { alert("Save the note first."); return; }
  $("playlistDropdown").innerHTML = playlists.length ? playlists.map(p => {
    const checked = p.notes.includes(editingId) ? "checked" : "";
    return `<label><input type="checkbox" data-add-playlist="${p.id}" ${checked}> ${escapeHtml(p.name)}</label>`;
  }).join("") : `<p style="padding:8px;margin:0">Create a playlist first.</p>`;
  $("playlistDropdown").classList.toggle("show");
}
function togglePlaylist(pid, checked) {
  const p = playlists.find(x => x.id === pid); if (!p || !editingId) return;
  if (checked) p.notes = [...new Set([...p.notes, editingId])];
  else p.notes = p.notes.filter(x => x !== editingId);
  saveData(); render();
}
function closeMenu() { $("sidebar").classList.remove("open"); $("overlay").classList.remove("show"); }
function openMenu() { $("sidebar").classList.add("open"); $("overlay").classList.add("show"); }
function applySettings() {
  document.body.dataset.theme = data.settings.theme || "green";
  document.body.classList.toggle("dark", !!data.settings.darkMode);
}
function exportNotes() {
  saveData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href=url; a.download="MyNotesBackup.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
}

// Direct listeners for main controls
$("menuBtn").addEventListener("click", openMenu);
$("closeMenu").addEventListener("click", closeMenu);
$("overlay").addEventListener("click", closeMenu);
$("newNoteBtn").addEventListener("click", () => { closeMenu(); openNewNote(); });
$("headerNewNote").addEventListener("click", openNewNote);
$("createPlaylistBtn").addEventListener("click", () => { closeMenu(); openPlaylistModal(); });
$("createPlaylistBtn2").addEventListener("click", openPlaylistModal);
$("saveNoteBtn").addEventListener("click", saveCurrentNote);
$("favoriteBtn").addEventListener("click", toggleFavorite);
$("pinBtn").addEventListener("click", togglePin);
$("playlistMenuBtn").addEventListener("click", openPlaylistDropdown);
$("savePlaylistBtn").addEventListener("click", savePlaylist);
$("exportBtn").addEventListener("click", exportNotes);
$("hiddenNotesBtn").addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeMenu();

  const modal = $("hiddenNotesModal");
  const container = $("hiddenNotesList");
  const hidden = notes.filter(n => n && n.hidden === true);

  container.innerHTML = hidden.length
    ? hidden.map(n => `
      <article class="note-card hidden-note-card" data-hidden-note="${n.id}">
        <h3>${escapeHtml(n.title || "Untitled")}</h3>
        <p>${escapeHtml(n.content || "Empty note").slice(0,130)}</p>
        <div class="note-meta">${escapeHtml(n.tags || "No tags")}</div>
      </article>`).join("")
    : `<div class="empty">No hidden notes.</div>`;

  modal.classList.add("show");
});
$("searchInput").addEventListener("input", render);
$("themeToggle").addEventListener("click", () => {
  data.settings.darkMode = !data.settings.darkMode;
  applySettings(); saveData();
});

document.querySelectorAll("[data-theme-choice]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    data.settings.theme = button.dataset.themeChoice;
    applySettings(); saveData();
  });
});

// One reliable delegated click handler. This fixes dynamically rendered playlist cards too.
document.addEventListener("click", event => {
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) {
    event.preventDefault();
    event.stopPropagation();
    hideModal(closeButton.dataset.close);
    return;
  }

  const playlistCheckbox = event.target.closest("[data-add-playlist]");
  if (playlistCheckbox) {
    togglePlaylist(playlistCheckbox.dataset.addPlaylist, playlistCheckbox.checked);
    return;
  }

  const noteCard = event.target.closest(".note-card[data-note]");
  if (noteCard) {
    if (pressTriggered || $("longPressMenu").classList.contains("show")) {
      event.preventDefault();
      return;
    }
    if (noteCard.closest("#playlistViewNotes")) hideModal("playlistViewModal");
    openNote(noteCard.dataset.note);
    return;
  }

  const playlistCard = event.target.closest("[data-playlist]");
  if (playlistCard) {
    closeMenu();
    viewPlaylist(playlistCard.dataset.playlist);
    return;
  }

  if (!event.target.closest(".dropdown")) $("playlistDropdown").classList.remove("show");
});

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) hideModal(modal.id);
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal.show").forEach(modal => hideModal(modal.id));
    closeMenu();
  }
});

window.addEventListener("pagehide", saveData);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveData();
});
window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY) {
    data = loadData(); notes = data.notes; playlists = data.playlists;
    applySettings(); render();
  }
});


$("longPressMenu").addEventListener("click", e => {
  const btn = e.target.closest("[data-note-action]");
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const action = btn.dataset.noteAction;
  const selectedId = longPressNoteId;

  if (!selectedId) return;

  if (action === "hide") {
    hideNote(selectedId);
  } else {
    runLongPressAction(action);
  }
}, true);
$("hiddenNotesList").addEventListener("click", e => {
  const card = e.target.closest("[data-hidden-note]");
  if (!card) return;
  const noteId = card.dataset.hiddenNote;
  if (confirm("Unhide this note and show it again?")) unhideNote(noteId);
});

function startNotePress(noteId) {
  pressTriggered = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    pressTriggered = true;
    if (navigator.vibrate) navigator.vibrate(35);
    openLongPressMenu(noteId);
  }, 1000);
}
function cancelNotePress() {
  clearTimeout(pressTimer);
  pressTimer = null;
}
$("notesList").addEventListener("pointerdown", e => {
  const card = e.target.closest("[data-note]");
  if (!card) return;
  startNotePress(card.dataset.note);
});
$("notesList").addEventListener("pointerup", cancelNotePress);
$("notesList").addEventListener("pointerleave", cancelNotePress);
$("notesList").addEventListener("pointercancel", cancelNotePress);
$("notesList").addEventListener("click", e => {
  if (pressTriggered) {
    e.preventDefault();
    e.stopPropagation();
    pressTriggered = false;
  }
}, true);

applySettings(); saveData(); render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
}