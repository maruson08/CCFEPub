/* global Blockly */
import { operationsToCommandText, processOperations } from "./engine.js";
import { createChatbotApp } from "./app.js";

const WORKSPACE_STORAGE = "ccfepub.blocklyWorkspace.v2";
const outputLog = document.querySelector("#outputLog");
const statusArea = document.querySelector("#statusArea");
let lastOperations = [];
let saveTimer = null;

function setStatus(message, kind = "info") {
  const icons = { success: "✓", error: "⚠", warning: "⚠", info: "•" };
  statusArea.className = `status ${kind}`;
  statusArea.textContent = `${icons[kind] || "•"} ${message}`;
}

const app = createChatbotApp({ onStatus: setStatus });

if (typeof Blockly === "undefined") {
  setStatus("Blockly 라이브러리를 불러오지 못했습니다. 네트워크를 확인해 주세요.", "error");
  throw new Error("Blockly is not available");
}

const workspace = Blockly.inject("blocklyDiv", {
  toolbox: document.querySelector("#toolbox"),
  trashcan: true,
  scrollbars: true,
  renderer: "zelos",
  grid: { spacing: 24, length: 3, colour: "#d4d4cf", snap: true },
  zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.4, minScale: 0.5 },
});

function loadDefaultWorkspace() {
  const xmlText = `<xml xmlns="https://developers.google.com/blockly/xml">
    <block type="chatbot_set_name" x="32" y="32"><field name="NAME">블록지니</field><next>
      <block type="chatbot_set_role"><field name="ROLE">친절한 코딩 멘토</field><next>
        <block type="chatbot_when_says"><field name="TRIGGER">안녕</field><field name="REPLY">안녕하세요! 블록 코딩 시작해 볼까요? 😊</field><next>
          <block type="chatbot_start"></block>
        </next></block>
      </next></block>
    </next></block>
  </xml>`;
  const dom = Blockly.utils.xml.textToDom(xmlText);
  Blockly.Xml.domToWorkspace(dom, workspace);
}

function restoreWorkspace() {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE);
    if (!raw) {
      loadDefaultWorkspace();
      return;
    }
    const saved = JSON.parse(raw);
    if (saved.format === "json" && Blockly.serialization?.workspaces) {
      Blockly.serialization.workspaces.load(saved.data, workspace);
    } else if (saved.format === "xml") {
      Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(saved.data), workspace);
    } else {
      throw new Error("지원하지 않는 저장 형식입니다");
    }
  } catch (error) {
    console.warn("Saved Blockly workspace could not be restored:", error);
    workspace.clear();
    loadDefaultWorkspace();
    try { localStorage.removeItem(WORKSPACE_STORAGE); } catch { /* Ignore. */ }
    setStatus("저장된 블록을 복원할 수 없어 기본 예제를 열었습니다.", "warning");
  }
}

function saveWorkspace() {
  try {
    const saved = Blockly.serialization?.workspaces
      ? { format: "json", data: Blockly.serialization.workspaces.save(workspace) }
      : { format: "xml", data: Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)) };
    localStorage.setItem(WORKSPACE_STORAGE, JSON.stringify(saved));
  } catch (error) {
    console.warn("Blockly workspace could not be saved:", error);
    setStatus("블록 자동 저장에 실패했습니다.", "warning");
  }
}

function blockToOperation(block) {
  const field = (name) => block.getFieldValue(name) || "";
  switch (block.type) {
    case "chatbot_set_name": return { type: "setName", value: field("NAME") };
    case "chatbot_set_role": return { type: "setRole", value: field("ROLE") };
    case "chatbot_set_personality": return { type: "setPersonality", value: field("PERSONALITY") };
    case "chatbot_set_tone": return { type: "setTone", value: field("TONE") };
    case "chatbot_when_says": return { type: "addRule", match: "exact", trigger: field("TRIGGER"), reply: field("REPLY") };
    case "chatbot_when_includes": return { type: "addRule", match: "includes", trigger: field("KEYWORD"), reply: field("REPLY") };
    case "chatbot_default_reply": return { type: "setDefaultReply", value: field("REPLY") };
    case "chatbot_limit_length": return { type: "setLimitLength", value: Number(field("LENGTH")) };
    case "chatbot_use_emoji": return { type: "setUseEmoji", value: field("USE") === "TRUE" };
    case "chatbot_block_personal_info": return { type: "blockPersonalInfo" };
    case "chatbot_block_sensitive_topics": return { type: "setSensitiveTopics", topics: field("TOPICS").split(/[,\s]+/).filter(Boolean) };
    case "chatbot_safe_reply": return { type: "setSafeReply", value: field("REPLY") };
    case "chatbot_add_knowledge": return { type: "addKnowledge", subject: field("SUBJECT"), description: field("DESCRIPTION") };
    case "chatbot_add_example": return { type: "addExample", user: field("USER"), assistant: field("ASSISTANT") };
    case "chatbot_show_system_prompt": return { type: "preview" };
    case "chatbot_start": return { type: "start" };
    default: return null;
  }
}

function collectOperations() {
  const operations = [];
  const unknown = [];
  const stacks = workspace.getTopBlocks(true);
  for (const top of stacks) {
    let block = top;
    while (block) {
      const operation = blockToOperation(block);
      if (operation) operations.push(operation);
      else unknown.push(block.type);
      block = block.getNextBlock();
    }
  }
  return { operations, unknown };
}

function prepare({ executeActions = false } = {}) {
  const { operations, unknown } = collectOperations();
  lastOperations = operations;
  const result = processOperations(operations);
  app.setConfig(result.config);
  const commands = operationsToCommandText(operations);
  outputLog.textContent = commands || "연결된 챗봇 블록이 없습니다.";
  if (unknown.length) setStatus(`지원하지 않는 블록을 건너뛰었습니다: ${[...new Set(unknown)].join(", ")}`, "warning");
  else setStatus(`${operations.length}개 블록을 공통 엔진에 적용했습니다.`, "success");
  if (executeActions) {
    if (result.actions.preview) app.showPreview();
    if (result.actions.start) app.start();
  }
  return result;
}

async function copyCommands() {
  prepare();
  try {
    await navigator.clipboard.writeText(operationsToCommandText(lastOperations));
    setStatus("생성된 명령어를 복사했습니다.", "success");
  } catch {
    setStatus("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.", "error");
  }
}

restoreWorkspace();
workspace.addChangeListener((event) => {
  if (event.isUiEvent) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveWorkspace, 180);
});
window.addEventListener("resize", () => Blockly.svgResize(workspace));
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    prepare({ executeActions: true });
  }
});
document.querySelector("#runCommandsButton").addEventListener("click", () => prepare({ executeActions: true }));
document.querySelector("#previewPromptButton").addEventListener("click", () => { prepare(); app.showPreview(); });
document.querySelector("#copyCommandsButton").addEventListener("click", copyCommands);
document.querySelector("#resetWorkspaceButton").addEventListener("click", () => {
  if (!window.confirm("현재 블록을 지우고 기본 예제로 돌아갈까요?")) return;
  workspace.clear();
  loadDefaultWorkspace();
  saveWorkspace();
  prepare();
});
prepare();
