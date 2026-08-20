import test from "node:test";
import assert from "node:assert/strict";

class FakeElement extends EventTarget {
  constructor() {
    super();
    this.value = "";
    this.textContent = "";
    this.className = "";
    this.type = "button";
    this.disabled = false;
    this.open = false;
    this.style = {};
    this.attributes = new Map();
    this.children = [];
    this.classList = {
      add: (...names) => names.forEach((name) => this.#classes().add(name)),
      remove: (...names) => {
        const classes = this.#classes();
        names.forEach((name) => classes.delete(name));
        this.className = [...classes].join(" ");
      },
      contains: (name) => this.#classes().has(name),
    };
  }

  #classes() {
    const classes = new Set(this.className.split(/\s+/).filter(Boolean));
    const originalAdd = classes.add.bind(classes);
    classes.add = (name) => {
      originalAdd(name);
      this.className = [...classes].join(" ");
      return classes;
    };
    return classes;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() { this.focused = true; }
  append(node) { this.children.push(node); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  select() {}
  remove() {}
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const ids = [
  "apiKey", "toggleApiKey", "clearApiKey", "promptPreview", "previewDialog",
  "closePreview", "chatbotName", "chatContainer", "chatLog", "userInput",
  "sendMessageButton", "commandInput", "outputLog", "statusArea",
  "runCommandsButton", "previewPromptButton", "copyCommandsButton",
  "resetExampleButton", "switchToBlock", "exportProjectButton",
  "importProjectInput", "inspector", "inspectorState", "inspectorName",
  "inspectorRules", "inspectorKnowledge", "inspectorTopics", "inspectorLimit",
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
elements.apiKey.type = "password";
elements.chatContainer.className = "chat-area hidden";

globalThis.document = {
  querySelector(selector) { return elements[selector.slice(1)] ?? null; },
  querySelectorAll(selector) { return selector === ".example-button" ? [] : []; },
  createElement() { return new FakeElement(); },
  body: new FakeElement(),
  execCommand() { return true; },
};
const navigations = [];
globalThis.window = {
  confirm: () => true,
  setTimeout,
  clearTimeout,
  location: { assign: (url) => navigations.push(url) },
};
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();

const consoleErrors = [];
const originalConsoleError = console.error;
console.error = (...args) => consoleErrors.push(args);

await import(`../script.js?run-integration=${Date.now()}`);
consoleErrors.length = 0;

const flush = () => new Promise((resolve) => setImmediate(resolve));
const click = async (element) => {
  element.dispatchEvent(new Event("click"));
  await flush();
};

test("Run click parses the default example and reports a missing API key", async () => {
  await click(elements.runCommandsButton);
  assert.match(elements.outputLog.textContent, /Name: AI 친구/);
  assert.match(elements.statusArea.textContent, /Gemini API 키/);
  assert.equal(elements.apiKey.focused, true);
  assert.equal(elements.previewDialog.open, false, "API key error must not be hidden behind preview");
  assert.equal(elements.runCommandsButton.disabled, false);
  assert.equal(
    consoleErrors.some((args) => String(args[0]).includes("Text editor Run failed")),
    false,
  );
});

test("Run click shows a line-numbered parser error", async () => {
  elements.commandInput.value = "notARealCommand()";
  await click(elements.runCommandsButton);
  assert.match(elements.statusArea.textContent, /Line 1: 알 수 없는 명령어/);
  assert.match(elements.outputLog.textContent, /Line 1:/);
  assert.equal(elements.runCommandsButton.disabled, false);
});

test("Ctrl+Enter uses the same Run path", async () => {
  elements.commandInput.value = "startChatbot()";
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperties(event, {
    key: { value: "Enter" },
    ctrlKey: { value: true },
    metaKey: { value: false },
  });
  elements.commandInput.dispatchEvent(event);
  await flush();
  assert.equal(event.defaultPrevented, true);
  assert.match(elements.statusArea.textContent, /Gemini API 키/);
});

test("Inspector updates after a debounced valid edit", async () => {
  elements.commandInput.value = 'setName("Inspector Bot")\naddKnowledge("언어", "こんにちは 😀")';
  elements.commandInput.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(elements.inspectorName.textContent, "Inspector Bot");
  assert.equal(elements.inspectorKnowledge.textContent, "1");
  assert.match(elements.inspectorState.textContent, /up to date/);
});

test("Inspector keeps the last valid project when source contains errors", async () => {
  elements.commandInput.value = "notARealCommand()";
  elements.commandInput.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(elements.inspectorName.textContent, "Inspector Bot");
  assert.match(elements.inspectorState.textContent, /contains errors/);
});

test("valid project JSON import replaces the canonical Text view", async () => {
  const imported = {
    format: "ccfepub-project",
    formatVersion: 1,
    editorMode: "block",
    operations: [{ type: "setName", value: "Imported Bot" }],
    metadata: { name: "Imported Bot", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  };
  elements.importProjectInput.files = [{ text: async () => JSON.stringify(imported) }];
  elements.importProjectInput.dispatchEvent(new Event("change"));
  await flush();
  await flush();
  assert.equal(elements.commandInput.value, 'setName("Imported Bot")');
  assert.equal(elements.inspectorName.textContent, "Imported Bot");
  assert.match(elements.statusArea.textContent, /가져왔습니다/);
});

test("invalid source blocks editor switching without losing the canonical project", async () => {
  elements.commandInput.value = "notARealCommand()";
  await click(elements.switchToBlock);
  assert.equal(navigations.length, 0);
  assert.match(elements.statusArea.textContent, /오류를 수정해야/);
});

test("valid source saves canonical operations before switching to Blocks", async () => {
  elements.commandInput.value = 'setName("Switch Bot")';
  await click(elements.switchToBlock);
  assert.equal(navigations.at(-1), "./block.html");
  const project = JSON.parse(localStorage.getItem("ccfepub.project.v1"));
  assert.deepEqual(project.operations, [{ type: "setName", value: "Switch Bot" }]);
  assert.equal(project.editorMode, "block");
});

test("API key Show, Hide, and Clear controls remain wired", async () => {
  elements.apiKey.value = "test-key-never-logged";
  elements.apiKey.dispatchEvent(new Event("input"));
  assert.equal(sessionStorage.getItem("ccfepub.geminiApiKey"), "test-key-never-logged");

  await click(elements.toggleApiKey);
  assert.equal(elements.apiKey.type, "text");
  assert.equal(elements.toggleApiKey.textContent, "Hide");
  await click(elements.toggleApiKey);
  assert.equal(elements.apiKey.type, "password");

  await click(elements.clearApiKey);
  assert.equal(elements.apiKey.value, "");
  assert.equal(sessionStorage.getItem("ccfepub.geminiApiKey"), null);
  assert.equal(elements.toggleApiKey.textContent, "Show");
});

test.after(() => {
  console.error = originalConsoleError;
});
