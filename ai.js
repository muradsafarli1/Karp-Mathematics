import {app, auth} from "/karp-firebase.js";
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {getFunctions, httpsCallable} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const functions = getFunctions(app, "europe-west1");
const askKarpAI = httpsCallable(functions, "askKarpAI", {timeout: 120000});
const getKarpAIUsage = httpsCallable(functions, "getKarpAIUsage", {timeout: 20000});

const el = (id) => document.getElementById(id);
const ui = {
  sidebar: el("ai-sidebar"),
  backdrop: el("ai-mobile-backdrop"),
  mobileMenu: el("ai-mobile-menu"),
  newChat: el("ai-new-chat"),
  headerNew: el("ai-header-new"),
  clearHistory: el("ai-clear-history"),
  history: el("ai-history"),
  messages: el("ai-messages"),
  messageList: el("ai-message-list"),
  welcome: el("ai-welcome"),
  form: el("ai-form"),
  input: el("ai-input"),
  send: el("ai-send-button"),
  attach: el("ai-attach-button"),
  fileInput: el("ai-file-input"),
  attachmentPreview: el("ai-attachment-preview"),
  attachmentName: el("ai-attachment-name"),
  removeAttachment: el("ai-remove-attachment"),
  limitText: el("ai-limit-text"),
  limitBar: el("ai-limit-bar"),
  accountName: el("ai-account-name"),
  accountAvatar: el("ai-account-avatar"),
  authGate: el("ai-auth-gate"),
  disclaimer: document.querySelector(".ai-disclaimer")
};

const DAILY_TOKEN_LIMIT = 5000;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_LOCAL_CHATS = 15;
const MAX_LOCAL_MESSAGES = 40;
let currentUser = null;
let currentKey = "";
let chats = [];
let activeChatId = "";
let pendingFile = null;
let usage = {usedTokens:0,reservedTokens:0,limitTokens:DAILY_TOKEN_LIMIT,remainingTokens:DAILY_TOKEN_LIMIT,date:""};
let backendReady = false;
let sending = false;
let lastUsageRefreshAt = 0;

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "chat_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function markdownHtml(value) {
  const text = String(value || "").replace(/\r\n?/g, "\n");
  const fence = String.fromCharCode(96).repeat(3);
  const segments = text.split(fence);

  return segments.map((segment, index) => {
    if (index % 2 === 1) {
      const code = segment.replace(/^[a-zA-Z0-9_-]*\n/, "");
      return "<pre><code>" + escapeHtml(code) + "</code></pre>";
    }

    const lines = escapeHtml(segment).split("\n");
    return lines.map((line) => {
      if (!line.trim()) return "<div class=\"ai-md-gap\"></div>";
      if (line.startsWith("### ")) return "<h3>" + line.slice(4) + "</h3>";
      if (line.startsWith("## ")) return "<h2>" + line.slice(3) + "</h2>";
      if (line.startsWith("# ")) return "<h1>" + line.slice(2) + "</h1>";
      if (/^\s*[-*]\s+/.test(line)) return "<div class=\"ai-md-list-item\">• " + line.replace(/^\s*[-*]\s+/, "") + "</div>";
      if (/^\s*\d+[.)]\s+/.test(line)) return "<div class=\"ai-md-list-item\">" + line + "</div>";
      return "<p>" + line
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/__([^_]+)__/g, "<strong>$1</strong>") + "</p>";
    }).join("");
  }).join("");
}

function getActiveChat() {
  return chats.find((chat) => chat.id === activeChatId) || null;
}

function storeChats() {
  if (!currentKey) return;
  try {
    chats = chats
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      .slice(0, MAX_LOCAL_CHATS);
    chats.forEach((chat) => {
      chat.messages = Array.isArray(chat.messages) ? chat.messages.slice(-MAX_LOCAL_MESSAGES) : [];
    });
    localStorage.setItem(currentKey, JSON.stringify(chats));
  } catch (error) {
    console.warn("KARP AI chat history could not be saved:", error);
  }
}

function createChat() {
  const chat = {
    id: makeId(),
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };
  chats.unshift(chat);
  activeChatId = chat.id;
  storeChats();
  renderAll();
  closeMobileSidebar();
  ui.input.focus();
}

function loadChats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(currentKey) || "[]");
    chats = Array.isArray(parsed) ? parsed.filter((chat) =>
      chat && typeof chat.id === "string" && Array.isArray(chat.messages)
    ) : [];
  } catch {
    chats = [];
  }

  chats = chats.slice(0, MAX_LOCAL_CHATS);
  if (chats.length) {
    activeChatId = chats[0].id;
  } else {
    const first = {
      id: makeId(),
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    chats = [first];
    activeChatId = first.id;
    storeChats();
  }
  renderAll();
}

function renderHistory() {
  if (!chats.length) {
    ui.history.innerHTML = '<div class="ai-history-empty">Your conversations will appear here.</div>';
    return;
  }

  ui.history.innerHTML = chats.map((chat) => {
    const active = chat.id === activeChatId ? " active" : "";
    return '<button class="ai-history-item' + active + '" type="button" data-chat-id="' + escapeHtml(chat.id) + '">' +
      '<span class="ai-history-icon">◷</span><span class="ai-history-title">' + escapeHtml(chat.title || "New chat") + "</span></button>";
  }).join("");

  ui.history.querySelectorAll("[data-chat-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeChatId = button.getAttribute("data-chat-id");
      renderAll();
      closeMobileSidebar();
    });
  });
}

function messageMarkup(message) {
  const isUser = message.role === "user";
  const label = isUser ? "You" : "KARP AI";
  const avatar = isUser ? "You" : "K";
  const bubble = markdownHtml(message.text || "");
  const attachment = message.fileName
    ? '<div class="ai-message-file"><span>▧</span>' + escapeHtml(message.fileName) + "</div>"
    : "";
  const tokenMeta = Number(message.tokenUsage) > 0
    ? '<div class="ai-token-usage">' + Math.round(Number(message.tokenUsage)).toLocaleString() + " tokens used</div>"
    : "";
  return '<article class="ai-message' + (isUser ? " user" : "") + '">' +
    '<div class="ai-message-avatar">' + avatar + "</div>" +
    '<div class="ai-message-content"><div class="ai-message-label">' + label + "</div>" +
    '<div class="ai-message-bubble">' + bubble + attachment + "</div>" + tokenMeta + "</div></article>";
}

function renderMessages() {
  const chat = getActiveChat();
  const messages = chat ? chat.messages : [];
  ui.welcome.hidden = messages.length > 0;
  ui.messageList.innerHTML = messages.map(messageMarkup).join("");
  if (messages.length) {
    requestAnimationFrame(() => {
      ui.messages.scrollTop = ui.messages.scrollHeight;
      typesetMath();
    });
  } else {
    ui.messages.scrollTop = 0;
  }
}

function renderAll() {
  renderHistory();
  renderMessages();
  updateSendState();
}

function typesetMath() {
  if (!window.MathJax || typeof window.MathJax.typesetPromise !== "function") return;
  window.MathJax.typesetPromise([ui.messageList]).catch((error) => {
    console.warn("KARP AI math rendering skipped:", error);
  });
}

function renderUsage(nextUsage) {
 const usedTokens=Math.max(0,Number(nextUsage?.usedTokens)||0);
 const reservedTokens=Math.max(0,Number(nextUsage?.reservedTokens)||0);
 const limitTokens=Math.max(1,Number(nextUsage?.limitTokens)||DAILY_TOKEN_LIMIT);
 const remainingTokens=Math.max(0,Number(nextUsage?.remainingTokens)||0);
 usage={usedTokens,reservedTokens,limitTokens,remainingTokens,date:String(nextUsage?.date||"")};
 ui.limitText.textContent=remainingTokens.toLocaleString()+" tokens left";
 ui.limitBar.style.width=(100*Math.min(limitTokens,usedTokens+reservedTokens)/limitTokens)+"%";
 ui.limitBar.style.background=remainingTokens<=500?"linear-gradient(90deg,#d79a44,#d35c5c)":"linear-gradient(90deg,#3867e8,#7c4dff)";
 updateSendState();
}

async function refreshUsage(force = false) {
  if (!currentUser) return;
  const now = Date.now();
  if (!force && now - lastUsageRefreshAt < 5000) return;
  lastUsageRefreshAt = now;
  try {
    const result = await getKarpAIUsage({});
    renderUsage(result.data || {});
    backendReady = true;
    if (ui.disclaimer) ui.disclaimer.textContent = "KARP AI can make mistakes. Verify important proofs and contest information independently.";
  } catch (error) {
    backendReady = false;
    ui.limitText.textContent = "Setup required";
    ui.limitBar.style.width = "0%";
    if (ui.disclaimer) ui.disclaimer.textContent = "KARP AI's Firebase backend is not deployed yet. Complete the one-time setup in KARP_AI_SETUP.md.";
    console.warn("KARP AI usage status is unavailable:", error);
    updateSendState();
  }
}

function updateSendState() {
  const blockedByLimit = usage.remainingTokens <= 0;
  const hasContent = Boolean(ui.input.value.trim() || pendingFile);
  ui.send.disabled = sending || !backendReady || blockedByLimit || !hasContent;
  ui.attach.disabled = sending || !backendReady || blockedByLimit;
  ui.input.disabled = sending || !backendReady || blockedByLimit;
  if (!backendReady) ui.input.placeholder = "AI setup is required before sending a message...";
  else if (blockedByLimit) ui.input.placeholder = "Daily token budget used — resets at 00:00 Baku time";
  else ui.input.placeholder = "Ask an olympiad mathematics question...";
}

function showAuthGate(user, reason) {
  ui.authGate.hidden = Boolean(user && user.emailVerified);
  if (!ui.authGate.hidden) {
    const heading = ui.authGate.querySelector("h2");
    const paragraph = ui.authGate.querySelector("p");
    if (heading && reason === "verify") heading.textContent = "Verify your email first";
    if (paragraph && reason === "verify") paragraph.textContent = "Please verify the email address on your KARP account, then sign in again to use KARP AI.";
  }
}

function setMobileSidebar(open) {
  ui.sidebar.classList.toggle("open", Boolean(open));
  ui.backdrop.classList.toggle("show", Boolean(open));
}

function closeMobileSidebar() {
  setMobileSidebar(false);
}

function setPendingFile(file) {
  pendingFile = file || null;
  if (pendingFile) {
    ui.attachmentPreview.hidden = false;
    ui.attachmentName.textContent = pendingFile.name + " · " + (pendingFile.size / 1024 / 1024).toFixed(2) + " MB";
  } else {
    ui.attachmentPreview.hidden = true;
    ui.attachmentName.textContent = "";
    ui.fileInput.value = "";
  }
  updateSendState();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the attachment."));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const comma = dataUrl.indexOf(",");
      if (comma < 0) reject(new Error("The attachment could not be prepared."));
      else resolve(dataUrl.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

function friendlyError(error) {
  const code = String(error?.code || "");
  if (code.includes("resource-exhausted")) return "This request needs more tokens than you have left today, or your daily token budget is exhausted. It resets at 00:00 Baku time.";
  if (code.includes("unauthenticated")) return "Please sign in to your KARP account before using KARP AI.";
  if (code.includes("failed-precondition")) return error.message || "Please verify your email address and check the Gemini API setup.";
  if (code.includes("invalid-argument")) return error.message || "The message or attachment is not valid.";
  if (code.includes("not-found")) return "The KARP AI backend has not been deployed yet. Follow KARP_AI_SETUP.md to finish setup.";
  return error?.message || "KARP AI could not complete this request. Please try again.";
}

async function sendMessage() {
  if (sending || !backendReady || usage.remaining <= 0 || !currentUser) return;

  const rawText = ui.input.value.trim();
  const file = pendingFile;
  if (!rawText && !file) return;
  if (file && file.size > MAX_FILE_BYTES) {
    alert("Please attach a file smaller than 4 MB.");
    return;
  }

  const prompt = rawText || "Please solve the attached olympiad mathematics problem and explain your reasoning step by step.";
  const chat = getActiveChat();
  if (!chat) return;

  const history = chat.messages.slice(-10).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    text: String(message.text || "").slice(0, 4000)
  }));
  const displayText = rawText || "Please solve this attached olympiad problem.";
  const userMessage = {
    role: "user",
    text: displayText,
    fileName: file ? file.name : "",
    createdAt: Date.now()
  };

  chat.messages.push(userMessage);
  if (chat.title === "New chat") {
    chat.title = displayText.replace(/\s+/g, " ").slice(0, 44) || (file ? file.name : "Olympiad problem");
  }
  chat.updatedAt = Date.now();
  ui.input.value = "";
  ui.input.style.height = "36px";
  setPendingFile(null);
  storeChats();
  renderAll();

  sending = true;
  updateSendState();
  const typing = document.createElement("article");
  typing.className = "ai-message";
  typing.innerHTML = '<div class="ai-message-avatar">K</div><div class="ai-message-content"><div class="ai-message-label">KARP AI</div><div class="ai-message-bubble ai-typing"><span></span><span></span><span></span></div></div>';
  ui.messageList.appendChild(typing);
  ui.messages.scrollTop = ui.messages.scrollHeight;

  try {
    const payload = {text: prompt, history};
    if (file) {
      payload.file = {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data: await readFileAsBase64(file)
      };
    }

    const result = await askKarpAI(payload);
    typing.remove();
    const data = result.data || {};
    chat.messages.push({
      role: "assistant",
      text: String(data.answer || "I could not produce an answer. Please try again."),
      topic: String(data.topic || ""),
      inScope: data.inScope === true,
      tokenUsage: Number(data.tokenUsage?.totalTokens) || 0,
      createdAt: Date.now()
    });
    if (data.usage) renderUsage(data.usage);
  } catch (error) {
    typing.remove();
    chat.messages.push({
      role: "assistant",
      text: friendlyError(error),
      createdAt: Date.now()
    });
    if (String(error?.code || "").includes("resource-exhausted")) {
      await refreshUsage(true);
    } else if (String(error?.code || "").includes("not-found")) {
      backendReady = false;
    }
    console.error("KARP AI request failed:", error);
  } finally {
    chat.updatedAt = Date.now();
    storeChats();
    sending = false;
    renderAll();
    ui.input.focus();
    if (!backendReady) refreshUsage();
  }
}

ui.newChat.addEventListener("click", createChat);
ui.headerNew.addEventListener("click", createChat);
ui.clearHistory.addEventListener("click", () => {
  if (!confirm("Clear all KARP AI conversations saved in this browser?")) return;
  chats = [];
  localStorage.removeItem(currentKey);
  createChat();
});
ui.mobileMenu.addEventListener("click", () => setMobileSidebar(!ui.sidebar.classList.contains("open")));
ui.backdrop.addEventListener("click", closeMobileSidebar);
ui.attach.addEventListener("click", () => ui.fileInput.click());
ui.fileInput.addEventListener("change", () => {
  const file = ui.fileInput.files && ui.fileInput.files[0];
  if (!file) return;
  const allowed = ["image/jpeg","image/png","image/webp","image/heic","image/heif","application/pdf"];
  if (!allowed.includes(file.type)) {
    alert("Attach a JPG, PNG, WEBP, HEIC image or a PDF file.");
    ui.fileInput.value = "";
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    alert("Please attach a file smaller than 4 MB.");
    ui.fileInput.value = "";
    return;
  }
  setPendingFile(file);
});
ui.removeAttachment.addEventListener("click", () => setPendingFile(null));
ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});
ui.input.addEventListener("input", () => {
  ui.input.style.height = "36px";
  ui.input.style.height = Math.min(ui.input.scrollHeight, 150) + "px";
  updateSendState();
});
ui.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});
document.querySelectorAll(".ai-suggestion[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    ui.input.value = button.getAttribute("data-prompt") || "";
    ui.input.dispatchEvent(new Event("input"));
    ui.input.focus();
  });
});
window.addEventListener("focus", () => {
  if (currentUser && !sending) refreshUsage();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentUser && !sending) refreshUsage();
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  if (!user) {
    backendReady = false;
    showAuthGate(null, "login");
    updateSendState();
    return;
  }

  try { await user.reload(); } catch {}
  currentUser = auth.currentUser || user;
  try { await currentUser.getIdToken(true); } catch {}
  if (currentUser.emailVerified !== true) {
    backendReady = false;
    showAuthGate(null, "verify");
    updateSendState();
    return;
  }

  showAuthGate(currentUser);
  const name = currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "KARP member");
  ui.accountName.textContent = name;
  ui.accountAvatar.textContent = (name.charAt(0) || "K").toUpperCase();
  currentKey = "karp_ai_chats_v1_" + currentUser.uid;
  loadChats();
  await refreshUsage(true);
});
