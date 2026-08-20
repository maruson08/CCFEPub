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
  state.textContent = "Canonical project is up to date.";
  document.querySelector("#inspectorName").textContent = config.name;
  document.querySelector("#inspectorRules").textContent = String(config.rules.length);
  document.querySelector("#inspectorKnowledge").textContent = String(config.knowledge.length);
  document.querySelector("#inspectorTopics").textContent = String(config.sensitiveTopics.length);
  document.querySelector("#inspectorLimit").textContent = config.limitLength ? `${config.limitLength} chars` : "None";
  return config;
}

export function downloadProject(project) {
  const contents = serializeProject(project);
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (project.metadata.name || "my-chatbot")
    .normalize("NFKD")
    .replace(/[^\w\-가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "my-chatbot";
  link.href = url;
  link.download = `${safeName}.ccfepub.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(file) {
  if (!file || typeof file.text !== "function") throw new Error("Choose a JSON project file.");
  return parseProjectJson(await file.text());
}
