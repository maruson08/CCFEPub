import { generateSystemPrompt, resolveLocalResponse } from "./engine.js";

const API_KEY_STORAGE = "ccfepub.geminiApiKey";
const GEMINI_SDK_URL = "https://cdn.jsdelivr.net/npm/@google/genai@1.24.0/dist/web/index.mjs";
const loadGeminiSdk = () => import(GEMINI_SDK_URL);

export const RUNTIME_STATES = Object.freeze({
  IDLE: "Idle",
  VALIDATING: "Validating",
  API_KEY_REQUIRED: "API key required",
  STARTING: "Starting",
  READY: "Ready",
  SENDING: "Sending",
  ERROR: "Error",
  STALE: "Configuration changed. Run again",
});

export function mapGeminiError(error) {
  const detail = `${error?.status || ""} ${error?.code || ""} ${error?.message || error || ""}`.toLowerCase();
  if (/api.?key|permission.?denied|unauth|401|403/.test(detail)) {
    return "API 키가 유효하지 않습니다. 키를 확인한 뒤 다시 실행해 주세요.";
  }
  if (/quota|rate|resource.?exhausted|429/.test(detail)) {
    return "요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (/network|fetch|offline|failed to fetch|timeout/.test(detail) || error instanceof TypeError) {
    return "네트워크에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.";
  }
  return "Gemini 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

export function createChatbotApp({ onStatus, loadSdk = loadGeminiSdk }) {
  const elements = {
    apiKey: document.querySelector("#apiKey"),
    toggleKey: document.querySelector("#toggleApiKey"),
    clearKey: document.querySelector("#clearApiKey"),
    promptPreview: document.querySelector("#promptPreview"),
    previewDialog: document.querySelector("#previewDialog"),
    closePreview: document.querySelector("#closePreview"),
    copyPrompt: document.querySelector("#copyPromptButton"),
    chatbotName: document.querySelector("#chatbotName"),
    chatContainer: document.querySelector("#chatContainer"),
    chatLog: document.querySelector("#chatLog"),
    userInput: document.querySelector("#userInput"),
    sendMessage: document.querySelector("#sendMessageButton"),
    clearChat: document.querySelector("#clearChatButton"),
  };
  let config = null;
  let configSignature = "";
  let chatSession = null;
  let sessionFactory = null;
  let runtimeState = RUNTIME_STATES.IDLE;

  const status = (message, kind = "info") => onStatus?.(message, kind);
  const setRuntimeState = (state, message, kind = "info") => {
    runtimeState = state;
    elements.chatContainer.dataset.runtimeState = state;
    status(`${state} · ${message}`, kind);
  };
  const appendMessage = (text, sender) => {
    const node = document.createElement("div");
    node.className = `message ${sender}`;
    node.textContent = text;
    elements.chatLog.append(node);
    elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
  };
  const enableChatInput = (enabled) => {
    elements.userInput.disabled = !enabled;
    elements.sendMessage.disabled = !enabled;
    if (enabled) elements.userInput.focus();
  };
  const showGreeting = () => {
    elements.chatContainer.classList.remove("hidden");
    elements.chatLog.replaceChildren();
    appendMessage(`안녕하세요! 저는 ${config.name}입니다. 무엇을 이야기해 볼까요?`, "assistant");
  };
  const invalidateRuntime = (message = "Configuration changed. Run again") => {
    if (!chatSession && runtimeState !== RUNTIME_STATES.READY && runtimeState !== RUNTIME_STATES.SENDING) return;
    chatSession = null;
    sessionFactory = null;
    enableChatInput(false);
    setRuntimeState(RUNTIME_STATES.STALE, message, "warning");
  };

  try {
    elements.apiKey.value = sessionStorage.getItem(API_KEY_STORAGE) || "";
  } catch {
    status("세션 저장소를 사용할 수 없어 API 키를 페이지 이동 시 유지하지 않습니다.", "warning");
  }
  elements.apiKey.addEventListener("input", () => {
    invalidateRuntime("API key changed. Run again");
    try {
      if (elements.apiKey.value) sessionStorage.setItem(API_KEY_STORAGE, elements.apiKey.value);
      else sessionStorage.removeItem(API_KEY_STORAGE);
    } catch {
      status("API 키를 세션에 저장하지 못했지만 현재 페이지에서는 계속 사용할 수 있습니다.", "warning");
    }
  });
  elements.toggleKey.addEventListener("click", () => {
    const show = elements.apiKey.type === "password";
    elements.apiKey.type = show ? "text" : "password";
    elements.toggleKey.textContent = show ? "Hide" : "Show";
    elements.toggleKey.setAttribute("aria-pressed", String(show));
  });
  elements.clearKey.addEventListener("click", () => {
    elements.apiKey.value = "";
    elements.apiKey.type = "password";
    elements.toggleKey.textContent = "Show";
    elements.toggleKey.setAttribute("aria-pressed", "false");
    try { sessionStorage.removeItem(API_KEY_STORAGE); } catch { /* The app remains usable without storage. */ }
    chatSession = null;
    sessionFactory = null;
    enableChatInput(false);
    setRuntimeState(RUNTIME_STATES.API_KEY_REQUIRED, "API 키를 지웠습니다.", "warning");
    elements.apiKey.focus();
  });
  elements.closePreview.addEventListener("click", () => elements.previewDialog.close());
  elements.previewDialog.addEventListener("click", (event) => {
    if (event.target === elements.previewDialog) elements.previewDialog.close();
  });
  elements.copyPrompt.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(config ? generateSystemPrompt(config) : "");
      status("System prompt를 복사했습니다.", "success");
    } catch {
      status("System prompt를 클립보드에 복사하지 못했습니다.", "error");
    }
  });

  async function sendMessage() {
    const message = elements.userInput.value.trim();
    if (!message || !config || !chatSession) return;
    appendMessage(message, "user");
    elements.userInput.value = "";
    enableChatInput(false);
    setRuntimeState(RUNTIME_STATES.SENDING, "응답을 기다리는 중입니다…");
    const localReply = resolveLocalResponse(config, message);
    if (localReply) {
      appendMessage(localReply, "assistant");
      enableChatInput(true);
      setRuntimeState(RUNTIME_STATES.READY, "Test Chat을 사용할 수 있습니다.", "success");
      return;
    }
    try {
      const response = await chatSession.sendMessage({ message });
      let text = response.text || config.defaultReply;
      if (config.limitLength && text.length > config.limitLength) text = `${text.slice(0, config.limitLength)}…`;
      appendMessage(text, "assistant");
      setRuntimeState(RUNTIME_STATES.READY, "Test Chat을 사용할 수 있습니다.", "success");
    } catch (error) {
      appendMessage(mapGeminiError(error), "assistant");
      setRuntimeState(RUNTIME_STATES.ERROR, mapGeminiError(error), "error");
    } finally {
      enableChatInput(Boolean(chatSession));
    }
  }
  elements.sendMessage.addEventListener("click", sendMessage);
  elements.userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing && !elements.userInput.disabled) sendMessage();
  });
  elements.clearChat.addEventListener("click", () => {
    elements.chatLog.replaceChildren();
    if (sessionFactory && config) {
      try {
        chatSession = sessionFactory();
        showGreeting();
        enableChatInput(true);
        setRuntimeState(RUNTIME_STATES.READY, "대화만 지웠습니다. 프로젝트 설정과 API 키는 유지됩니다.", "success");
      } catch (error) {
        chatSession = null;
        sessionFactory = null;
        enableChatInput(false);
        setRuntimeState(RUNTIME_STATES.ERROR, mapGeminiError(error), "error");
      }
    } else {
      enableChatInput(false);
      setRuntimeState(runtimeState === RUNTIME_STATES.STALE ? RUNTIME_STATES.STALE : RUNTIME_STATES.IDLE, "대화를 지웠습니다. Run으로 Test Chat을 시작하세요.");
    }
  });

  return {
    setConfig(nextConfig) {
      const nextSignature = JSON.stringify(nextConfig);
      if (configSignature && nextSignature !== configSignature) invalidateRuntime();
      config = nextConfig;
      configSignature = nextSignature;
      elements.chatbotName.textContent = config.name;
    },
    setValidating() {
      setRuntimeState(RUNTIME_STATES.VALIDATING, "프로젝트 설정을 확인하는 중입니다…");
    },
    setIdle(message = "프로젝트를 편집하거나 Run을 눌러 Test Chat을 시작하세요.") {
      setRuntimeState(RUNTIME_STATES.IDLE, message);
    },
    setError(message) {
      setRuntimeState(RUNTIME_STATES.ERROR, message, "error");
    },
    showPreview() {
      if (!config) return;
      elements.promptPreview.textContent = generateSystemPrompt(config);
      elements.previewDialog.showModal();
    },
    getPrompt() {
      return config ? generateSystemPrompt(config) : "";
    },
    getState() {
      return runtimeState;
    },
    async start() {
      if (!config) return false;
      setRuntimeState(RUNTIME_STATES.VALIDATING, "프로젝트 설정을 확인하는 중입니다…");
      const apiKey = elements.apiKey.value.trim();
      if (!apiKey) {
        setRuntimeState(RUNTIME_STATES.API_KEY_REQUIRED, "Gemini API 키를 입력한 뒤 다시 실행해 주세요.", "error");
        elements.apiKey.focus();
        return false;
      }
      setRuntimeState(RUNTIME_STATES.STARTING, "Gemini SDK를 불러오는 중입니다…");
      let GoogleGenAI;
      try {
        ({ GoogleGenAI } = await loadSdk());
      } catch {
        setRuntimeState(RUNTIME_STATES.ERROR, "Gemini SDK를 불러오지 못했습니다. 네트워크 또는 CDN 차단 상태를 확인해 주세요.", "error");
        return false;
      }
      if (typeof GoogleGenAI !== "function") {
        setRuntimeState(RUNTIME_STATES.ERROR, "Gemini SDK 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.", "error");
        return false;
      }
      try {
        const client = new GoogleGenAI({ apiKey });
        const activePrompt = generateSystemPrompt(config);
        sessionFactory = () => client.chats.create({
          model: "gemini-2.5-flash",
          config: { systemInstruction: activePrompt },
        });
        chatSession = sessionFactory();
        showGreeting();
        enableChatInput(true);
        setRuntimeState(RUNTIME_STATES.READY, "Test Chat을 사용할 수 있습니다.", "success");
        return true;
      } catch (error) {
        chatSession = null;
        sessionFactory = null;
        enableChatInput(false);
        setRuntimeState(RUNTIME_STATES.ERROR, mapGeminiError(error), "error");
        return false;
      }
    },
  };
}
