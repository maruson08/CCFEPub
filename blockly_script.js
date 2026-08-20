/* global Blockly */
import { operationsToCommandText, parseCommandText, processOperations } from "./engine.js";
import { createChatbotApp } from "./app.js";
import { blockRecordToOperation, operationsToBlockRecords } from "./block_mapping.js";
import { DEFAULT_EXAMPLE_SOURCE } from "./examples.js";
import { createProject, migrateLegacyProject, saveProject, updateProject, validateProject } from "./project.js";
import { downloadProject, readProjectFile, renderInspector } from "./project_ui.js";

const outputLog = document.querySelector("#outputLog");
const statusArea = document.querySelector("#statusArea");
const runButton = document.querySelector("#runCommandsButton");
let currentProject = null;

function setStatus(message, kind = "info") {
  const icons = { success: "✓", error: "⚠", warning: "⚠", info: "•" };
  statusArea.className = `status ${kind}`;
  statusArea.textContent = `${icons[kind] || "•"} ${message}`;
}

const app = createChatbotApp({ onStatus: setStatus });

if (typeof Blockly === "undefined") {
  setStatus("Block editor could not load Blockly. Text Editor is still available.", "error");
  document.querySelectorAll("[data-blockly-action]").forEach((button) => { button.disabled = true; });
} else {
  initializeBlockEditor();
}

function initializeBlockEditor() {
  const workspace = Blockly.inject("blocklyDiv", {
    toolbox: document.querySelector("#toolbox"), trashcan: true, scrollbars: true, renderer: "zelos",
    grid: { spacing: 24, length: 3, colour: "#d4d4cf", snap: true },
    zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.4, minScale: 0.5 },
  });
  const exampleOperations = parseCommandText(DEFAULT_EXAMPLE_SOURCE).operations;
  let applyingWorkspace = false;
  let saveTimer = null;

  function blockToRecord(block) {
    const fields = {};
    for (const input of block.inputList || []) {
      for (const field of input.fieldRow || []) if (field.name) fields[field.name] = field.getValue();
    }
    return { type: block.type, fields };
  }

  function workspaceToOperations() {
    const operations = [];
    for (const top of workspace.getTopBlocks(true)) {
      let block = top;
      while (block) {
        operations.push(blockRecordToOperation(blockToRecord(block)));
        block = block.getNextBlock();
      }
    }
    return operations;
  }

  function operationsToWorkspace(operations) {
    const records = operationsToBlockRecords(operations);
    applyingWorkspace = true;
    Blockly.Events.disable();
    try {
      workspace.clear();
      let previous = null;
      let stackY = 32;
      records.forEach((item, index) => {
        const block = workspace.newBlock(item.type);
        Object.entries(item.fields).forEach(([name, value]) => block.setFieldValue(String(value), name));
        block.initSvg();
        block.render();
        if (previous?.nextConnection && block.previousConnection) previous.nextConnection.connect(block.previousConnection);
        else { block.moveBy(36, stackY); stackY += 110 + index * 4; }
        previous = block;
      });
    } finally {
      Blockly.Events.enable();
      applyingWorkspace = false;
      Blockly.svgResize(workspace);
    }
  }

  function convertLegacyBlockly(source) {
    const saved = JSON.parse(source);
    workspace.clear();
    if (saved.format === "json" && Blockly.serialization?.workspaces) Blockly.serialization.workspaces.load(saved.data, workspace);
    else if (saved.format === "xml") Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(saved.data), workspace);
    else throw new Error("Unsupported legacy Blockly format.");
    return workspaceToOperations();
  }

  function saveOperations(operations, editorMode = "block") {
    currentProject = currentProject ? updateProject(currentProject, operations, editorMode) : createProject(operations, { editorMode });
    try { saveProject(localStorage, currentProject); }
    catch { setStatus("프로젝트를 브라우저에 저장하지 못했지만 현재 편집은 계속할 수 있습니다.", "warning"); }
    renderInspector(currentProject.operations);
    app.setConfig(processOperations(currentProject.operations).config);
    return currentProject;
  }

  function collectAndSave({ report = true } = {}) {
    try {
      const operations = workspaceToOperations();
      saveOperations(operations);
      if (report) {
        outputLog.textContent = operationsToCommandText(operations) || "Blank project\nAdd blocks or choose Load Example to begin.";
        setStatus(`${operations.length}개 블록을 canonical project에 적용했습니다.`, "success");
      }
      return { operations, ...processOperations(operations), errors: [] };
    } catch (error) {
      renderInspector(currentProject?.operations || [], { error: "block-errors" });
      if (report) app.setError(`블록을 변환할 수 없습니다: ${error.message}`);
      return { operations: [], errors: [error] };
    }
  }

  function replaceProject(operations, message) {
    operationsToBlockRecords(operations);
    const candidate = createProject(operations, { editorMode: "block" });
    try { saveProject(localStorage, candidate); }
    catch { setStatus("프로젝트를 저장하지 못했지만 현재 편집은 계속할 수 있습니다.", "warning"); }
    operationsToWorkspace(operations);
    currentProject = candidate;
    renderInspector(operations);
    app.setConfig(processOperations(operations).config);
    outputLog.textContent = operationsToCommandText(operations) || "Blank project\nAdd blocks or choose Load Example to begin.";
    setStatus(message, "success");
  }

  async function runEditor() {
    try {
      runButton.disabled = true;
      runButton.textContent = "Running…";
      app.setValidating();
      const result = collectAndSave();
      if (result.errors.length) return;
      if (result.actions.start) {
        if (!(await app.start())) return;
      } else {
        app.setIdle("설정은 유효하지만 startChatbot 블록이 없습니다.");
      }
      if (result.actions.preview) app.showPreview();
    } catch (error) {
      setStatus(`실행 중 오류가 발생했습니다: ${error.message}`, "error");
    } finally {
      runButton.disabled = false;
      runButton.textContent = "Run";
    }
  }

  function initializeProject() {
    let migration;
    try {
      migration = migrateLegacyProject(localStorage, { preferredMode: "block", parseLegacyText: parseCommandText, convertLegacyBlockly });
    } catch (error) {
      migration = { project: null, warnings: [error.message] };
    }
    currentProject = migration.project || createProject([], { editorMode: "block" });
    if (!migration.project && !migration.blocked) {
      try { saveProject(localStorage, currentProject); } catch { /* Storage is an optional boundary. */ }
    }
    try {
      operationsToWorkspace(currentProject.operations);
      renderInspector(currentProject.operations);
      app.setConfig(processOperations(currentProject.operations).config);
      outputLog.textContent = operationsToCommandText(currentProject.operations) || "Blank project\nAdd blocks or choose Load Example to begin.";
      if (migration.migratedFrom) setStatus(`기존 ${migration.migratedFrom} 작업을 project format v1으로 이전했습니다.`, "success");
      else if (migration.warnings?.length) setStatus(migration.warnings.join("\n"), "warning");
      else setStatus(currentProject.operations.length ? "Idle · 프로젝트를 편집하거나 Run을 눌러 Test Chat을 시작하세요." : "Idle · 새 프로젝트입니다. 블록을 추가하거나 예제를 불러오세요.");
    } catch (error) {
      setStatus(`이 프로젝트를 Block Editor에서 열 수 없습니다: ${error.message}`, "error");
    }
  }

  workspace.addChangeListener((event) => {
    if (applyingWorkspace || event.isUiEvent) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => collectAndSave({ report: false }), 300);
  });
  window.addEventListener("resize", () => Blockly.svgResize(workspace));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); runEditor(); }
  });
  runButton.addEventListener("click", runEditor);
  document.querySelector("#previewPromptButton").addEventListener("click", () => { const result = collectAndSave(); if (!result.errors.length) app.showPreview(); });
  document.querySelector("#copyCommandsButton").addEventListener("click", async () => {
    const result = collectAndSave();
    if (result.errors.length) return;
    try { await navigator.clipboard.writeText(operationsToCommandText(result.operations)); setStatus("생성된 명령어를 복사했습니다.", "success"); }
    catch { setStatus("클립보드 복사에 실패했습니다.", "error"); }
  });
  document.querySelector("#newProjectButton").addEventListener("click", () => {
    if (currentProject.operations.length && !window.confirm("현재 프로젝트를 지우고 새 프로젝트를 만들까요?")) return;
    replaceProject([], "새 프로젝트를 만들었습니다. API 키는 유지됩니다.");
  });
  document.querySelector("#loadExampleButton").addEventListener("click", () => {
    if (currentProject.operations.length && !window.confirm("현재 프로젝트를 학습 도우미 예제로 바꿀까요?")) return;
    replaceProject(exampleOperations, "학습 도우미 예제를 불러왔습니다.");
  });
  document.querySelector("#switchToText").addEventListener("click", (event) => {
    event.preventDefault();
    const result = collectAndSave();
    if (result.errors.length) { setStatus("블록 오류를 수정해야 Text Editor로 전환할 수 있습니다.", "error"); return; }
    saveOperations(result.operations, "text");
    window.location.assign("./index.html");
  });
  document.querySelector("#exportProjectButton").addEventListener("click", () => { const result = collectAndSave(); if (!result.errors.length) downloadProject(currentProject); });
  document.querySelector("#importProjectInput").addEventListener("change", async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (currentProject.operations.length && !window.confirm("현재 프로젝트를 가져온 프로젝트로 바꿀까요?")) return;
      const imported = validateProject(await readProjectFile(file));
      operationsToBlockRecords(imported.operations);
      const candidate = updateProject(imported, imported.operations, "block");
      const previous = currentProject;
      operationsToWorkspace(candidate.operations);
      try {
        saveProject(localStorage, candidate);
      } catch (error) {
        operationsToWorkspace(previous.operations);
        throw error;
      }
      currentProject = candidate;
      renderInspector(candidate.operations);
      app.setConfig(processOperations(candidate.operations).config);
      outputLog.textContent = operationsToCommandText(candidate.operations) || "Blank project";
      setStatus("프로젝트를 가져왔습니다.", "success");
    } catch (error) {
      setStatus(`프로젝트를 가져올 수 없습니다. 현재 프로젝트는 유지됩니다: ${error.message}`, "error");
    } finally { event.target.value = ""; }
  });

  initializeProject();
}
