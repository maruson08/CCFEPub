import { operationsToCommandText, parseCommandText, processOperations } from "./engine.js";
import { createChatbotApp } from "./app.js";
import { operationsToBlockRecords } from "./block_mapping.js";
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

const examples = {
  basic: `// 챗봇의 기본 정보, 성격, 말투를 설정합니다.
setName("AI 친구")
setRole("다정하고 호기심 많은 대화 상대")
setPersonality("친절하고 때로는 농담을 던지는")
setTone("편안하고 친구같은 말투")
whenUserSays("안녕").reply("안녕하세요! 무엇을 도와드릴까요?")
whenUserIncludes("이름").reply("제 이름은 AI 친구입니다.")
blockPersonalInfo()
blockSensitiveTopics(["정치", "종교"])
safeReply("죄송하지만, 그 주제에 대해서는 이야기할 수 없어요.")
limitLength(100)
useEmoji(False)
addKnowledge("제작자", "세종과학고 동아리 Realize가 만들었어요.")
showSystemPrompt()
startChatbot()`,
  professional: `setName("컨설턴트 봇")
setRole("비즈니스 및 기술 컨설턴트")
setPersonality("논리적이고 분석적인")
setTone("전문적이고 정중한")
whenUserIncludes("기술").reply("최신 기술 트렌드를 함께 살펴보겠습니다.")
blockPersonalInfo()
blockSensitiveTopics(["정치", "종교", "성적인 농담"])
limitLength(150)
useEmoji(False)
showSystemPrompt()
startChatbot()`,
  boyfriend: `setName("지니")
setRole("나의 AI 남자친구")
setPersonality("다정하고 유머러스한")
setTone("따뜻하고 친근한 말투")
whenUserSays("사랑해").reply("나도 사랑해! 오늘은 우리 뭐할까?")
blockSensitiveTopics(["정치", "종교"])
useEmoji(True)
showSystemPrompt()
startChatbot()`,
  girlfriend: `setName("지니")
setRole("나의 AI 여자친구")
setPersonality("다정하고 애교가 많은")
setTone("사랑스럽고 친근한 말투")
whenUserSays("사랑해").reply("나도 사랑해! 오늘은 우리 뭐할까?")
blockSensitiveTopics(["정치", "종교"])
useEmoji(True)
showSystemPrompt()
startChatbot()`,
};

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
  catch { setStatus("프로젝트를 브라우저에 저장하지 못했습니다.", "warning"); }
  renderInspector(currentProject.operations);
  app.setConfig(processOperations(currentProject.operations).config);
  return currentProject;
}

function configSummary(result) {
  const { config } = result;
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
      setStatus(errors, "error");
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
    const result = parseEditor();
    if (result.errors.length) return;
    if (result.actions.start && !(await app.start())) return;
    if (result.actions.preview) app.showPreview();
  } catch (error) {
    console.error("Text editor Run failed:", error);
    setStatus(`실행 중 오류가 발생했습니다: ${error.message}`, "error");
  } finally {
    runButton.disabled = false;
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
    const initial = parseCommandText(examples.basic);
    currentProject = createProject(initial.operations, { editorMode: "text" });
    if (!migration.blocked) {
      try { saveProject(localStorage, currentProject); } catch { /* Storage can be unavailable. */ }
    }
  }
  commandInput.value = operationsToCommandText(currentProject.operations);
  renderInspector(currentProject.operations);
  app.setConfig(parseCommandText(commandInput.value).config);
  if (migration.migratedFrom) setStatus("기존 Text 작업을 project format v1으로 이전했습니다.", "success");
  else if (migration.warnings?.length) setStatus(migration.warnings.join("\n"), "warning");
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
document.querySelector("#resetExampleButton").addEventListener("click", () => {
  if (!window.confirm("현재 프로젝트를 지우고 기본 예제로 돌아갈까요?")) return;
  commandInput.value = examples.basic;
  currentProject = null;
  parseEditor();
  commandInput.focus();
});
document.querySelectorAll(".example-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (!window.confirm("현재 프로젝트를 선택한 예제로 바꿀까요?")) return;
    commandInput.value = examples[button.dataset.example];
    parseEditor();
  });
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
    const imported = validateProject(await readProjectFile(event.target.files?.[0]));
    const text = operationsToCommandText(imported.operations);
    currentProject = updateProject(imported, imported.operations, "text");
    saveProject(localStorage, currentProject);
    commandInput.value = text;
    renderInspector(currentProject.operations);
    app.setConfig(parseCommandText(text).config);
    setStatus("프로젝트를 가져왔습니다.", "success");
  } catch (error) {
    setStatus(`프로젝트를 가져올 수 없습니다: ${error.message}`, "error");
  } finally {
    event.target.value = "";
  }
});

initializeProject();
