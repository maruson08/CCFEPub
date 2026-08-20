import { processOperations } from "./engine.js";
import { parseProjectJson, serializeProject } from "./project.js";

export function renderInspector(operations, { error = "" } = {}) {
  const inspector = document.querySelector("#inspector");
  const state = document.querySelector("#inspectorState");
  if (error) {
    inspector.classList.add("has-errors");
    state.textContent = "Current source contains errors. Showing the last valid project.";
    return null;
  }
  const { config } = processOperations(operations);
  inspector.classList.remove("has-errors");
  state.textContent = operations.length
    ? "Canonical project is up to date."
    : "Blank project. Add commands or load the example to begin.";
  document.querySelector("#inspectorName").textContent = config.name;
  document.querySelector("#inspectorRules").textContent = String(config.rules.length);
  document.querySelector("#inspectorKnowledge").textContent = String(config.knowledge.length);
  document.querySelector("#inspectorTopics").textContent = String(config.sensitiveTopics.length);
  document.querySelector("#inspectorLimit").textContent = config.limitLength ? `${config.limitLength} chars` : "None";
  const projectName = document.querySelector("#projectName");
  if (projectName) projectName.textContent = config.name;
  return config;
}

export function projectFilename(name) {
  const safeName = String(name || "")
    .normalize("NFKC")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[. -]+$/g, "")
    .slice(0, 80);
  return `${safeName || "ccfepub-project"}.ccfepub.json`;
}

export function downloadProject(project) {
  const contents = serializeProject(project);
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = projectFilename(project.metadata.name);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(file) {
  if (!file || typeof file.text !== "function") throw new Error("Choose a JSON project file.");
  return parseProjectJson(await file.text());
}
