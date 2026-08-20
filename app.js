import { generateSystemPrompt, resolveLocalResponse } from "./engine.js";

const API_KEY_STORAGE = "ccfepub.geminiApiKey";
const GEMINI_SDK_URL = "https://cdn.jsdelivr.net/npm/@google/genai@1.24.0/dist/web/index.mjs";
const loadGeminiSdk = () => import(GEMINI_SDK_URL);

export function createChatbotApp({ onStatus, loadSdk = loadGeminiSdk }) {
  const elements = {
    apiKey: document.querySelector("#apiKey"),
    toggleKey: document.querySelector("#toggleApiKey"),
    clearKey: document.querySelector("#clearApiKey"),
    promptPreview: document.querySelector("#promptPreview"),
    previewDialog: document.querySelector("#previewDialog"),
    closePreview: document.querySelector("#closePreview"),
    chatbotName: document.querySelector("#chatbotName"),
    chatContainer: document.querySelector("#chatContainer"),
    chatLog: document.querySelector("#chatLog"),
    userInput: document.querySelector("#userInput"),
    sendMessage: document.querySelector("#sendMessageButton"),
  };
  let config = null;
  let chatSession = null;

  const status = (message, kind = "info") => onStatus?.(message, kind);
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

  try {
    elements.apiKey.value = sessionStorage.getItem(API_KEY_STORAGE) || "";
  } catch {
    status("세션 저장소를 사용할 수 없어 API 키를 페이지 이동 시 유지하지 않습니다.", "warning");
  }
  elements.apiKey.addEventListener("input", () => {
    try {
      if (elements.apiKey.value) sessionStorage.setItem(API_KEY_STORAGE, elements.apiKey.value);
      else sessionStorage.removeItem(API_KEY_STORAGE);
    } catch { /* Private browsing policies can disable storage. */ }
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
    try { sessionStorage.removeItem(API_KEY_STORAGE); } catch { /* Ignore. */ }
    chatSession = null;
    enableChatInput(false);
    status("API 키를 지웠습니다.", "success");
  });
  elements.closePreview.addEventListener("click", () => elements.previewDialog.close());
  elements.previewDialog.addEventListener("click", (event) => {
    if (event.target === elements.previewDialog) elements.previewDialog.close();
  });

  async function sendMessage() {
    const message = elements.userInput.value.trim();
    if (!message || !config) return;
    appendMessage(message, "user");
    elements.userInput.value = "";
    enableChatInput(false);
    const localReply = resolveLocalResponse(config, message);
    if (localReply) {
      appendMessage(localReply, "assistant");
      enableChatInput(true);
      return;
    }
    if (!chatSession) {
      appendMessage("먼저 유효한 API 키로 챗봇을 시작해 주세요.", "assistant");
      return;
    }
    try {
      const response = await chatSession.sendMessage({ message });
      let text = response.text || config.defaultReply;
      if (config.limitLength && text.length > config.limitLength) text = `${text.slice(0, config.limitLength)}…`;
      appendMessage(text, "assistant");
    } catch (error) {
      console.error("Gemini request failed:", error);
      appendMessage("대화 요청에 실패했습니다. API 키와 네트워크를 확인해 주세요.", "assistant");
    } finally {
      enableChatInput(true);
    }
  }
  elements.sendMessage.addEventListener("click", sendMessage);
  elements.userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing && !elements.userInput.disabled) sendMessage();
  });

  return {
    setConfig(nextConfig) {
      config = nextConfig;
      elements.chatbotName.textContent = config.name;
    },
    showPreview() {
      if (!config) return;
      elements.promptPreview.textContent = generateSystemPrompt(config);
      elements.previewDialog.showModal();
    },
    getPrompt() {
      return config ? generateSystemPrompt(config) : "";
    },
    async start() {
      if (!config) return false;
      const apiKey = elements.apiKey.value.trim();
      if (!apiKey) {
        status("Gemini API 키를 입력한 뒤 다시 실행해 주세요.", "error");
        elements.apiKey.focus();
        return false;
      }
      try {
        const { GoogleGenAI } = await loadSdk();
        if (typeof GoogleGenAI !== "function") {
          throw new Error("GoogleGenAI export is unavailable");
        }
        const client = new GoogleGenAI({ apiKey });
        chatSession = client.chats.create({
          model: "gemini-2.5-flash",
          config: { systemInstruction: generateSystemPrompt(config) },
        });
        elements.chatContainer.classList.remove("hidden");
        elements.chatLog.replaceChildren();
        appendMessage(`안녕하세요! 저는 ${config.name}입니다. 무엇을 이야기해 볼까요?`, "assistant");
        enableChatInput(true);
        status("챗봇을 시작했습니다.", "success");
        return true;
      } catch (error) {
        console.error("Gemini initialization failed:", error);
        status("챗봇 초기화에 실패했습니다. API 키와 네트워크를 확인해 주세요.", "error");
        return false;
      }
    },
  };
}
