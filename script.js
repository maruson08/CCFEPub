import { operationsToCommandText, parseCommandText, processOperations } from "./engine.js";
import { createChatbotApp } from "./app.js";
import { operationsToBlockRecords } from "./block_mapping.js";
import { DEFAULT_EXAMPLE_SOURCE } from "./examples.js";
import {
  createProject,
  migrateLegacyProject,
  saveProject,
  updateProject,
  validateProject,
} from "./project.js";
import { downloadProject, readProjectFile, renderInspector } from "./project_ui.js";

const commandInput = document.querySelector("#commandInput");
const outputLog = document.querySelector("#outputLog");
const statusArea = document.querySelector("#statusArea");
const runButton = document.querySelector("#runCommandsButton");
let currentProject = null;
let inspectorTimer = null;

function setStatus(message, kind = "info") {
  const icons = { success: "✓", error: "⚠", warning: "⚠", info: "•" };
  statusArea.className = `status ${kind}`;
  statusArea.textContent = `${icons[kind] || "•"} ${message}`;
}

const app = createChatbotApp({ onStatus: setStatus });

function saveOperations(operations, editorMode = "text") {
  currentProject = currentProject
    ? updateProject(currentProject, operations, editorMode)
    : createProject(operations, { editorMode });
  try { saveProject(localStorage, currentProject); }
  catch { setStatus("프로젝트를 브라우저에 저장하지 못했지만 현재 편집은 계속할 수 있습니다.", "warning"); }
  renderInspector(currentProject.operations);
  app.setConfig(processOperations(currentProject.operations).config);
  return currentProject;
}

function configSummary(result) {
  const { config } = result;
  if (!result.operations.length) return "Blank project\nAdd commands or choose Load Example to begin.";
  return [
    `Name: ${config.name}`,
    `Role: ${config.role}`,
    `Rules: ${config.rules.length}`,
    `Knowledge: ${config.knowledge.length}`,
    `Sensitive topics: ${config.sensitiveTopics.length ? config.sensitiveTopics.join(", ") : "none"}`,
    `Response limit: ${config.limitLength ? `${config.limitLength} characters` : "none"}`,
  ].join("\n");
}

function parseEditor({ report = true } = {}) {
  const result = parseCommandText(commandInput.value);
  if (result.errors.length) {
    renderInspector(currentProject?.operations || [], { error: "source-errors" });
    if (report) {
      const errors = result.errors.map((error) => `Line ${error.line}: ${error.message}`).join("\n");
      outputLog.textContent = errors;
      app.setError(errors);
    }
    return result;
  }
  saveOperations(result.operations);
  if (report) {
    outputLog.textContent = configSummary(result);
    setStatus(`${result.operations.length}개 명령어를 canonical project에 적용했습니다.`, "success");
  }
  return result;
}

async function runEditor() {
  try {
    runButton.disabled = true;
    runButton.textContent = "Running…";
    app.setValidating();
    const result = parseEditor();
    if (result.errors.length) return;
    if (result.actions.start) {
      if (!(await app.start())) return;
    } else {
      app.setIdle("설정은 유효하지만 startChatbot() 명령이 없습니다.");
    }
    if (result.actions.preview) app.showPreview();
  } catch (error) {
    setStatus(`실행 중 오류가 발생했습니다: ${error.message}`, "error");
  } finally {
    runButton.disabled = false;
    runButton.textContent = "Run";
  }
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(message, "success");
  } catch {
    setStatus("클립보드 복사에 실패했습니다.", "error");
  }
}

function hasProjectContent() {
  return Boolean(currentProject?.operations.length || commandInput.value.trim());
}

function confirmReplacement(message) {
  return !hasProjectContent() || window.confirm(message);
}

function replaceProject(operations, message) {
  const candidate = createProject(operations, { editorMode: "text" });
  try { saveProject(localStorage, candidate); }
  catch { setStatus("프로젝트를 저장하지 못했지만 현재 편집은 계속할 수 있습니다.", "warning"); }
  currentProject = candidate;
  commandInput.value = operationsToCommandText(operations);
  renderInspector(operations);
  app.setConfig(processOperations(operations).config);
  outputLog.textContent = operations.length ? configSummary({ operations, ...processOperations(operations) }) : "Blank project\nAdd commands or choose Load Example to begin.";
  setStatus(message, "success");
  commandInput.focus();
}

function initializeProject() {
  let migration;
  try {
    migration = migrateLegacyProject(localStorage, {
      preferredMode: "text",
      parseLegacyText: parseCommandText,
    });
  } catch (error) {
    migration = { project: null, warnings: [error.message] };
  }
  currentProject = migration.project;
  if (!currentProject) {
    currentProject = createProject([], { editorMode: "text" });
    if (!migration.blocked) {
      try { saveProject(localStorage, currentProject); } catch { /* Storage is an optional boundary. */ }
    }
  }
  commandInput.value = operationsToCommandText(currentProject.operations);
  renderInspector(currentProject.operations);
  app.setConfig(processOperations(currentProject.operations).config);
  outputLog.textContent = currentProject.operations.length
    ? configSummary(processOperations(currentProject.operations))
    : "Blank project\nAdd commands or choose Load Example to begin.";
  if (migration.migratedFrom) setStatus("기존 Text 작업을 project format v1으로 이전했습니다.", "success");
  else if (migration.warnings?.length) setStatus(migration.warnings.join("\n"), "warning");
  else setStatus(currentProject.operations.length ? "Idle · 프로젝트를 편집하거나 Run을 눌러 Test Chat을 시작하세요." : "Idle · 새 프로젝트입니다. 명령어를 추가하거나 예제를 불러오세요.");
}

commandInput.addEventListener("input", () => {
  window.clearTimeout(inspectorTimer);
  inspectorTimer = window.setTimeout(() => parseEditor({ report: false }), 400);
});
commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    runEditor();
  }
});
runButton.addEventListener("click", runEditor);
document.querySelector("#previewPromptButton").addEventListener("click", () => {
  const result = parseEditor();
  if (!result.errors.length) app.showPreview();
});
document.querySelector("#copyCommandsButton").addEventListener("click", () => copyText(commandInput.value, "명령어를 복사했습니다."));
document.querySelector("#newProjectButton").addEventListener("click", () => {
  if (!confirmReplacement("현재 프로젝트를 지우고 새 프로젝트를 만들까요?")) return;
  replaceProject([], "새 프로젝트를 만들었습니다. API 키는 유지됩니다.");
});
document.querySelector("#loadExampleButton").addEventListener("click", () => {
  if (!confirmReplacement("현재 프로젝트를 학습 도우미 예제로 바꿀까요?")) return;
  const example = parseCommandText(DEFAULT_EXAMPLE_SOURCE);
  replaceProject(example.operations, "학습 도우미 예제를 불러왔습니다.");
});
document.querySelector("#switchToBlock").addEventListener("click", (event) => {
  event.preventDefault();
  try {
    const result = parseEditor();
    if (result.errors.length) {
      setStatus("명령어 오류를 수정해야 Block Editor로 전환할 수 있습니다.", "error");
      return;
    }
    operationsToBlockRecords(result.operations);
    saveOperations(result.operations, "block");
    window.location.assign("./block.html");
  } catch (error) {
    setStatus(`Block Editor로 전환할 수 없습니다: ${error.message}`, "error");
  }
});
document.querySelector("#exportProjectButton").addEventListener("click", () => {
  const result = parseEditor();
  if (!result.errors.length) downloadProject(currentProject);
});
document.querySelector("#importProjectInput").addEventListener("change", async (event) => {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirmReplacement("현재 프로젝트를 가져온 프로젝트로 바꿀까요?")) return;
    const imported = validateProject(await readProjectFile(file));
    const text = operationsToCommandText(imported.operations);
    const candidate = updateProject(imported, imported.operations, "text");
    saveProject(localStorage, candidate);
    currentProject = candidate;
    commandInput.value = text;
    renderInspector(candidate.operations);
    app.setConfig(processOperations(candidate.operations).config);
    outputLog.textContent = configSummary({ operations: candidate.operations, ...processOperations(candidate.operations) });
    setStatus("프로젝트를 가져왔습니다.", "success");
  } catch (error) {
    setStatus(`프로젝트를 가져올 수 없습니다. 현재 프로젝트는 유지됩니다: ${error.message}`, "error");
  } finally {
    event.target.value = "";
  }
});

initializeProject();
