const $=id=>document.getElementById(id);
let notes=JSON.parse(localStorage.getItem("myNotes")||"[]");
let playlists=JSON.parse(localStorage.getItem("myPlaylists")||"[]");
let editingId=null;

function saveData(){localStorage.setItem("myNotes",JSON.stringify(notes));localStorage.setItem("myPlaylists",JSON.stringify(playlists))}
function specialPlaylist(name){let p=playlists.find(x=>x.name===name);if(!p){p={id:Date.now()+Math.random(),name,notes:[]};playlists.push(p)}return p}
function addToSpecial(noteId,name){let p=specialPlaylist(name);if(!p.notes.includes(noteId))p.notes.push(noteId)}
function removeFromSpecial(noteId,name){let p=playlists.find(x=>x.name===name);if(p)p.notes=p.notes.filter(id=>id!==noteId)}

function render(){
 const q=$("searchInput").value.toLowerCase();
 const filtered=[...notes].filter(n=>(n.title+n.tags+n.content).toLowerCase().includes(q)).sort((a,b)=>b.pinned-a.pinned||b.updated-a.updated);
 $("noteCount").textContent=`${filtered.length} note(s)`;
 $("notesList").innerHTML=filtered.length?filtered.map(n=>`<article class="note-card ${n.pinned?"pinned":""}" onclick="openNote('${n.id}')"><span class="badge">${n.favorite?"★ ":""}${n.pinned?"📌":""}</span><h3>${escapeHtml(n.title||"Untitled")}</h3><p>${escapeHtml(n.content||"Empty note").slice(0,130)}</p><div class="note-meta">${escapeHtml(n.tags||"No tags")}</div></article>`).join(""):`<div class="empty">No notes found. Create your first note!</div>`;
 const normalPlaylists=playlists;
 $("playlists").innerHTML=normalPlaylists.length?normalPlaylists.map(p=>`<div class="playlist-card" onclick="viewPlaylist('${p.id}')"><h3>📁 ${escapeHtml(p.name)}</h3><p>${p.notes.length} note(s)</p></div>`).join(""):`<div class="empty">No playlists yet.</div>`;
 $("sidebarPlaylists").innerHTML=playlists.map(p=>`<button class="menu-item" onclick="viewPlaylist('${p.id}');closeMenu()">📁 ${escapeHtml(p.name)}</button>`).join("");
 saveData();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function openNewNote(){editingId=null;$("editorHeading").textContent="Create Note";$("noteTitle").value="";$("noteTags").value="";$("noteContent").value="";$("favoriteBtn").textContent="☆ Favorite";$("pinBtn").textContent="📌 Pin";$("noteModal").classList.add("show")}
function openNote(id){let n=notes.find(x=>x.id===id);if(!n)return;editingId=id;$("editorHeading").textContent="Edit Note";$("noteTitle").value=n.title;$("noteTags").value=n.tags;$("noteContent").value=n.content;$("favoriteBtn").textContent=n.favorite?"★ Favorite":"☆ Favorite";$("pinBtn").textContent=n.pinned?"📌 Unpin":"📌 Pin";$("noteModal").classList.add("show")}
window.openNote=openNote;

$("saveNoteBtn").onclick=()=>{let n=editingId?notes.find(x=>x.id===editingId):null;if(!n){n={id:String(Date.now()),title:"",tags:"",content:"",favorite:false,pinned:false,updated:Date.now()};notes.push(n)}n.title=$("noteTitle").value.trim()||"Untitled";n.tags=$("noteTags").value.trim();n.content=$("noteContent").value;n.updated=Date.now();editingId=n.id;saveData();$("saveStatus").textContent="Saved ✓";render();setTimeout(()=>{$("saveStatus").textContent=""},1200)};
$("favoriteBtn").onclick=()=>{if(!editingId){alert("Please save the note first.");return}let n=notes.find(x=>x.id===editingId);n.favorite=!n.favorite;if(n.favorite)addToSpecial(n.id,"Favorites");else removeFromSpecial(n.id,"Favorites");$("favoriteBtn").textContent=n.favorite?"★ Favorite":"☆ Favorite";saveData();render()};
$("pinBtn").onclick=()=>{if(!editingId){alert("Please save the note first.");return}let n=notes.find(x=>x.id===editingId);n.pinned=!n.pinned;if(n.pinned)addToSpecial(n.id,"Pinned");else removeFromSpecial(n.id,"Pinned");$("pinBtn").textContent=n.pinned?"📌 Unpin":"📌 Pin";saveData();render()};

$("playlistMenuBtn").onclick=()=>{if(!editingId){alert("Please save the note first.");return}$("playlistDropdown").innerHTML=playlists.length?playlists.map(p=>`<label><input type="checkbox" ${p.notes.includes(editingId)?"checked":""} onchange="togglePlaylist('${p.id}','${editingId}',this.checked)"> ${escapeHtml(p.name)}</label>`).join(""):"<p style='padding:8px'>Create a playlist first.</p>";$("playlistDropdown").classList.toggle("show")};
window.togglePlaylist=(pid,nid,checked)=>{let p=playlists.find(x=>x.id==pid);if(checked&&!p.notes.includes(nid))p.notes.push(nid);if(!checked)p.notes=p.notes.filter(x=>x!==nid);saveData();render()};

function openPlaylistModal(){$("playlistName").value="";$("playlistNoteSelector").innerHTML=notes.map(n=>`<label class="selector-item"><input type="checkbox" value="${n.id}"> ${escapeHtml(n.title||"Untitled")}</label>`).join("")||"<p class='empty'>Create notes first, then select them.</p>";$("playlistModal").classList.add("show")}
$("savePlaylistBtn").onclick=()=>{let name=$("playlistName").value.trim();if(!name){alert("Enter a playlist name.");return}let ids=[...$("playlistNoteSelector").querySelectorAll("input:checked")].map(x=>x.value);playlists.push({id:String(Date.now()),name,notes:ids});saveData();render();$("playlistModal").classList.remove("show")};
function viewPlaylist(id){let p=playlists.find(x=>x.id==id);if(!p)return;$("playlistViewTitle").textContent="📁 "+p.name;let ns=notes.filter(n=>p.notes.includes(n.id));$("playlistViewNotes").innerHTML=ns.length?ns.map(n=>`<article class="note-card" onclick="closePlaylistView();openNote('${n.id}')"><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.content).slice(0,120)}</p></article>`).join(""):"<div class='empty'>No notes in this playlist.</div>";$("playlistViewModal").classList.add("show")}
window.viewPlaylist=viewPlaylist;window.closePlaylistView=()=>{$("playlistViewModal").classList.remove("show")};

function closeMenu(){$("sidebar").classList.remove("open");$("overlay").classList.remove("show")}window.closeMenu=closeMenu;
$("menuBtn").onclick=()=>{$("sidebar").classList.add("open");$("overlay").classList.add("show")};$("closeMenu").onclick=closeMenu;$("overlay").onclick=closeMenu;
$("newNoteBtn").onclick=()=>{closeMenu();openNewNote()};$("headerNewNote").onclick=openNewNote;
$("createPlaylistBtn").onclick=()=>{closeMenu();openPlaylistModal()};$("createPlaylistBtn2").onclick=openPlaylistModal;
$("themeToggle").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("darkMode",document.body.classList.contains("dark"))};
document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>{document.body.dataset.theme=b.dataset.themeChoice;localStorage.setItem("theme",b.dataset.themeChoice)});
$("searchInput").oninput=render;
document.querySelectorAll(".closeModal").forEach(b=>b.onclick=()=>{$("noteModal").classList.remove("show")});$(".closePlaylistModal").onclick=()=>{$("playlistModal").classList.remove("show")};$(".closePlaylistView").onclick=()=>{$("playlistViewModal").classList.remove("show")};
$("exportBtn").onclick=()=>{let data=JSON.stringify({notes,playlists},null,2);let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type:"application/json"}));a.download="MyNotesBackup.json";a.click();URL.revokeObjectURL(a.href)};
if(localStorage.getItem("darkMode")==="true")document.body.classList.add("dark");document.body.dataset.theme=localStorage.getItem("theme")||"green";render();
