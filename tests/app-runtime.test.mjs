import test from "node:test";
import assert from "node:assert/strict";
import { createChatbotApp, mapGeminiError, RUNTIME_STATES } from "../app.js";
import { processOperations } from "../engine.js";

class FakeElement extends EventTarget {
  constructor() {
    super();
    this.value = ""; this.textContent = ""; this.className = ""; this.type = "button";
    this.disabled = false; this.dataset = {}; this.children = []; this.attributes = new Map();
    this.classList = {
      add: (...names) => { const set = this.classes(); names.forEach((name) => set.add(name)); this.className = [...set].join(" "); },
      remove: (...names) => { const set = this.classes(); names.forEach((name) => set.delete(name)); this.className = [...set].join(" "); },
      contains: (name) => this.classes().has(name),
    };
  }
  classes() { return new Set(this.className.split(/\s+/).filter(Boolean)); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  focus() { this.focused = true; }
  append(node) { this.children.push(node); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

class MemoryStorage {
  constructor({ fail = false } = {}) { this.values = new Map(); this.fail = fail; }
  getItem(key) { if (this.fail) throw new Error("storage denied"); return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw new Error("storage denied"); this.values.set(key, String(value)); }
  removeItem(key) { if (this.fail) throw new Error("storage denied"); this.values.delete(key); }
}

const ids = ["apiKey", "toggleApiKey", "clearApiKey", "promptPreview", "previewDialog", "closePreview", "copyPromptButton", "chatbotName", "chatContainer", "chatLog", "userInput", "sendMessageButton", "clearChatButton"];

function fixture({ loadSdk, storage = new MemoryStorage() } = {}) {
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
  elements.apiKey.type = "password";
  elements.chatContainer.className = "hidden";
  const statuses = [];
  globalThis.document = {
    querySelector: (selector) => elements[selector.slice(1)],
    createElement: () => new FakeElement(),
  };
  globalThis.sessionStorage = storage;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => {} } } });
  const app = createChatbotApp({ onStatus: (message, kind) => statuses.push({ message, kind }), loadSdk });
  app.setConfig(processOperations([{ type: "setName", value: "Runtime Bot" }, { type: "start" }]).config);
  return { app, elements, statuses, storage };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
async function click(element) { element.dispatchEvent(new Event("click")); await flush(); }

test("missing API key enters the explicit required state and focuses the field", async () => {
  const { app, elements, statuses } = fixture({ loadSdk: async () => { throw new Error("must not load"); } });
  assert.equal(await app.start(), false);
  assert.equal(app.getState(), RUNTIME_STATES.API_KEY_REQUIRED);
  assert.equal(elements.apiKey.focused, true);
  assert.match(statuses.at(-1).message, /API key required/);
});

test("adapter starts, sends, clears conversation, and preserves configuration and API key", async () => {
  let sessions = 0;
  const sent = [];
  class GoogleGenAI {
    constructor({ apiKey }) { assert.equal(apiKey, "test-key"); this.chats = { create: () => { sessions += 1; return { sendMessage: async ({ message }) => { sent.push(message); return { text: "mock response" }; } }; } }; }
  }
  const { app, elements } = fixture({ loadSdk: async () => ({ GoogleGenAI }) });
  elements.apiKey.value = "test-key";
  assert.equal(await app.start(), true);
  assert.equal(app.getState(), RUNTIME_STATES.READY);
  assert.equal(elements.userInput.disabled, false);
  elements.userInput.value = "remote question";
  await click(elements.sendMessageButton);
  await flush();
  assert.deepEqual(sent, ["remote question"]);
  assert.equal(elements.chatLog.children.at(-1).textContent, "mock response");
  await click(elements.clearChatButton);
  assert.equal(sessions, 2, "Clear Chat creates a fresh Gemini conversation");
  assert.equal(elements.apiKey.value, "test-key");
  assert.match(elements.chatLog.children[0].textContent, /Runtime Bot/);
});

test("project and API key changes invalidate an active runtime", async () => {
  class GoogleGenAI { constructor() { this.chats = { create: () => ({ sendMessage: async () => ({ text: "ok" }) }) }; } }
  const { app, elements, statuses } = fixture({ loadSdk: async () => ({ GoogleGenAI }) });
  elements.apiKey.value = "test-key";
  await app.start();
  app.setConfig(processOperations([{ type: "setName", value: "Changed Bot" }]).config);
  assert.equal(app.getState(), RUNTIME_STATES.STALE);
  assert.equal(elements.userInput.disabled, true);
  assert.match(statuses.at(-1).message, /Configuration changed\. Run again/);
  await app.start();
  elements.apiKey.value = "different-key";
  elements.apiKey.dispatchEvent(new Event("input"));
  assert.equal(app.getState(), RUNTIME_STATES.STALE);
  assert.match(statuses.at(-1).message, /API key changed/);
  await app.start();
  await click(elements.clearApiKey);
  assert.equal(app.getState(), RUNTIME_STATES.API_KEY_REQUIRED);
  assert.equal(elements.userInput.disabled, true);
});

test("SDK loading failure is distinct and does not expose the API key", async () => {
  const secret = "secret-never-rendered";
  const { app, elements, statuses } = fixture({ loadSdk: async () => { throw new Error(`blocked ${secret}`); } });
  elements.apiKey.value = secret;
  assert.equal(await app.start(), false);
  assert.equal(app.getState(), RUNTIME_STATES.ERROR);
  assert.match(statuses.at(-1).message, /SDK를 불러오지 못했습니다/);
  assert.doesNotMatch(JSON.stringify(statuses), new RegExp(secret));
});

test("Gemini failures map to actionable user messages", () => {
  assert.match(mapGeminiError({ status: 403, message: "API key invalid" }), /유효하지/);
  assert.match(mapGeminiError({ status: 429, message: "RESOURCE_EXHAUSTED" }), /한도/);
  assert.match(mapGeminiError(new TypeError("Failed to fetch")), /네트워크/);
  assert.match(mapGeminiError(new Error("unknown")), /요청에 실패/);
});

test("sessionStorage failure warns but the app remains usable", () => {
  const { app, elements, statuses } = fixture({ storage: new MemoryStorage({ fail: true }), loadSdk: async () => ({}) });
  elements.apiKey.value = "page-only-key";
  assert.doesNotThrow(() => elements.apiKey.dispatchEvent(new Event("input")));
  assert.equal(app.getState(), RUNTIME_STATES.IDLE);
  assert.ok(statuses.some(({ message }) => /저장하지 못했지만/.test(message)));
});


test("adapter maps initialization and send failures without test-only production branches", async () => {
  class InvalidKeyClient { constructor() { throw { status: 403, message: "API key invalid" }; } }
  const init = fixture({ loadSdk: async () => ({ GoogleGenAI: InvalidKeyClient }) });
  init.elements.apiKey.value = "bad-key";
  assert.equal(await init.app.start(), false);
  assert.match(init.statuses.at(-1).message, /유효하지/);

  class FailingSendClient {
    constructor() { this.chats = { create: () => ({ sendMessage: async () => { throw { status: 429, message: "RESOURCE_EXHAUSTED" }; } }) }; }
  }
  const send = fixture({ loadSdk: async () => ({ GoogleGenAI: FailingSendClient }) });
  send.elements.apiKey.value = "valid-looking-key";
  await send.app.start();
  send.elements.userInput.value = "trigger remote error";
  await click(send.elements.sendMessageButton);
  await flush();
  assert.equal(send.app.getState(), RUNTIME_STATES.ERROR);
  assert.match(send.elements.chatLog.children.at(-1).textContent, /한도/);
});
