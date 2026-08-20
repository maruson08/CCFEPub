import test from "node:test";
import assert from "node:assert/strict";

class FakeElement extends EventTarget {
  constructor() {
    super(); this.value = ""; this.textContent = ""; this.className = ""; this.type = "button";
    this.disabled = false; this.open = false; this.dataset = {}; this.attributes = new Map(); this.children = [];
    this.classList = {
      add: (...names) => { const set = this.classes(); names.forEach((name) => set.add(name)); this.className = [...set].join(" "); },
      remove: (...names) => { const set = this.classes(); names.forEach((name) => set.delete(name)); this.className = [...set].join(" "); },
      contains: (name) => this.classes().has(name),
    };
  }
  classes() { return new Set(this.className.split(/\s+/).filter(Boolean)); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() { this.focused = true; }
  append(node) { this.children.push(node); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { this.dispatchEvent(new Event("click")); }
  remove() {}
}

class MemoryStorage {
  constructor() { this.values = new Map(); this.failWrites = false; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.failWrites) throw new Error("storage denied"); this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const ids = [
  "apiKey", "toggleApiKey", "clearApiKey", "promptPreview", "previewDialog", "closePreview", "copyPromptButton",
  "chatbotName", "chatContainer", "chatLog", "userInput", "sendMessageButton", "clearChatButton",
  "commandInput", "outputLog", "statusArea", "runCommandsButton", "previewPromptButton", "copyCommandsButton",
  "newProjectButton", "loadExampleButton", "switchToBlock", "exportProjectButton", "importProjectInput",
  "inspector", "inspectorState", "inspectorName", "inspectorRules", "inspectorKnowledge", "inspectorTopics", "inspectorLimit", "projectName",
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
elements.apiKey.type = "password";
elements.chatContainer.className = "chat-area hidden";

globalThis.document = {
  querySelector(selector) { return elements[selector.slice(1)] ?? null; },
  querySelectorAll() { return []; },
  createElement() { return new FakeElement(); },
  body: new FakeElement(),
};
const navigations = [];
const confirmations = [];
globalThis.window = {
  confirm: (message) => { confirmations.push(message); return true; },
  setTimeout, clearTimeout,
  location: { assign: (url) => navigations.push(url) },
};
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => {} } } });
URL.createObjectURL = () => "blob:test";
URL.revokeObjectURL = () => {};

await import(`../script.js?run-integration=${Date.now()}`);

const flush = () => new Promise((resolve) => setImmediate(resolve));
async function click(element) { element.dispatchEvent(new Event("click")); await flush(); }

test("first visit starts with a useful blank project empty state", () => {
  assert.equal(elements.commandInput.value, "");
  assert.match(elements.outputLog.textContent, /Blank project/);
  assert.match(elements.inspectorState.textContent, /Blank project/);
});

test("Load Example covers identity, exact/includes rules, knowledge, safety, and start", async () => {
  await click(elements.loadExampleButton);
  assert.match(elements.commandInput.value, /setName\("학습 도우미"\)/);
  assert.match(elements.commandInput.value, /whenUserSays/);
  assert.match(elements.commandInput.value, /whenUserIncludes/);
  assert.match(elements.commandInput.value, /addKnowledge/);
  assert.match(elements.commandInput.value, /blockSensitiveTopics/);
  assert.match(elements.commandInput.value, /startChatbot\(\)/);
  assert.equal(elements.inspectorName.textContent, "학습 도우미");
});

test("Run and Ctrl+Enter share validation and missing-key behavior", async () => {
  await click(elements.runCommandsButton);
  assert.match(elements.statusArea.textContent, /API key required/);
  assert.equal(elements.apiKey.focused, true);
  assert.equal(elements.runCommandsButton.disabled, false);
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperties(event, { key: { value: "Enter" }, ctrlKey: { value: true }, metaKey: { value: false } });
  elements.commandInput.dispatchEvent(event);
  await flush();
  assert.equal(event.defaultPrevented, true);
  assert.match(elements.statusArea.textContent, /API key required/);
});

test("New Project confirms replacement, clears project data, and preserves API key", async () => {
  elements.apiKey.value = "preserved-key";
  await click(elements.newProjectButton);
  assert.equal(elements.commandInput.value, "");
  assert.equal(elements.apiKey.value, "preserved-key");
  assert.match(confirmations.at(-1), /새 프로젝트/);
  const stored = JSON.parse(localStorage.getItem("ccfepub.project.v1"));
  assert.deepEqual(stored.operations, []);
});

test("invalid command reports a line number and preserves the last valid Inspector", async () => {
  const previousName = elements.inspectorName.textContent;
  elements.commandInput.value = "notARealCommand()";
  await click(elements.runCommandsButton);
  assert.match(elements.statusArea.textContent, /Line 1/);
  assert.equal(elements.inspectorName.textContent, previousName);
});

test("valid import replaces the project, invalid import is atomic", async () => {
  const imported = {
    format: "ccfepub-project", formatVersion: 1, editorMode: "block",
    operations: [{ type: "setName", value: "Imported Bot" }],
    metadata: { name: "Imported Bot", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  };
  elements.commandInput.value = "";
  elements.importProjectInput.files = [{ text: async () => JSON.stringify(imported) }];
  elements.importProjectInput.dispatchEvent(new Event("change"));
  await flush(); await flush();
  assert.equal(elements.commandInput.value, 'setName("Imported Bot")');
  elements.importProjectInput.files = [{ text: async () => "{bad json" }];
  elements.importProjectInput.dispatchEvent(new Event("change"));
  await flush(); await flush();
  assert.equal(elements.commandInput.value, 'setName("Imported Bot")');
  assert.match(elements.statusArea.textContent, /현재 프로젝트는 유지/);
});

test("storage failure during import preserves the current project", async () => {
  const before = elements.commandInput.value;
  const replacement = {
    format: "ccfepub-project", formatVersion: 1, editorMode: "text",
    operations: [{ type: "setName", value: "Must Not Apply" }],
    metadata: { name: "Must Not Apply", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  };
  localStorage.failWrites = true;
  elements.importProjectInput.files = [{ text: async () => JSON.stringify(replacement) }];
  elements.importProjectInput.dispatchEvent(new Event("change"));
  await flush(); await flush();
  localStorage.failWrites = false;
  assert.equal(elements.commandInput.value, before);
  assert.match(elements.statusArea.textContent, /현재 프로젝트는 유지/);
});

test("Export, API controls, Clear Chat, and mode navigation remain wired", async () => {
  await click(elements.exportProjectButton);
  elements.apiKey.value = "test-key";
  elements.apiKey.dispatchEvent(new Event("input"));
  assert.equal(sessionStorage.getItem("ccfepub.geminiApiKey"), "test-key");
  await click(elements.toggleApiKey);
  assert.equal(elements.apiKey.type, "text");
  await click(elements.clearApiKey);
  assert.equal(elements.apiKey.value, "");
  await click(elements.clearChatButton);
  assert.match(elements.statusArea.textContent, /대화를 지웠습니다/);
  elements.commandInput.value = 'setName("Switch Bot")';
  await click(elements.switchToBlock);
  assert.equal(navigations.at(-1), "./block.html");
});
