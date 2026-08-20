import { processOperations } from "./engine.js";

export const PROJECT_FORMAT = "ccfepub-project";
export const PROJECT_FORMAT_VERSION = 1;
export const PROJECT_STORAGE_KEY = "ccfepub.project.v1";
export const LEGACY_TEXT_STORAGE_KEY = "ccfepub.textCommands.v2";
export const LEGACY_BLOCK_STORAGE_KEY = "ccfepub.blocklyWorkspace.v2";

export class ProjectValidationError extends Error {
  constructor(message, code = "invalid-project") {
    super(message);
    this.name = "ProjectValidationError";
    this.code = code;
  }
}

const requireString = (value, field) => {
  if (typeof value !== "string") {
    throw new ProjectValidationError(`${field} must be a string.`);
  }
  return value;
};

function validateOperation(operation, index) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    throw new ProjectValidationError(`Operation ${index + 1} must be an object.`);
  }
  const field = (name) => requireString(operation[name], `Operation ${index + 1}.${name}`);
  switch (operation.type) {
    case "setName":
    case "setRole":
    case "setPersonality":
    case "setTone":
    case "setDefaultReply":
    case "setSafeReply":
      return { type: operation.type, value: field("value") };
    case "setLimitLength":
      if (!Number.isInteger(operation.value) || operation.value <= 0) {
        throw new ProjectValidationError(`Operation ${index + 1}.value must be a positive integer.`);
      }
      return { type: operation.type, value: operation.value };
    case "setUseEmoji":
      if (typeof operation.value !== "boolean") {
        throw new ProjectValidationError(`Operation ${index + 1}.value must be boolean.`);
      }
      return { type: operation.type, value: operation.value };
    case "blockPersonalInfo":
    case "preview":
    case "start":
      return { type: operation.type };
    case "setSensitiveTopics":
      if (!Array.isArray(operation.topics) || operation.topics.some((topic) => typeof topic !== "string")) {
        throw new ProjectValidationError(`Operation ${index + 1}.topics must be a string array.`);
      }
      return { type: operation.type, topics: [...operation.topics] };
    case "addKnowledge":
      return { type: operation.type, subject: field("subject"), description: field("description") };
    case "addExample":
      return { type: operation.type, user: field("user"), assistant: field("assistant") };
    case "addRule":
      if (operation.match !== "exact" && operation.match !== "includes") {
        throw new ProjectValidationError(`Operation ${index + 1}.match must be exact or includes.`);
      }
      return { type: operation.type, match: operation.match, trigger: field("trigger"), reply: field("reply") };
    case "notice":
      return { type: operation.type, command: field("command"), message: field("message") };
    default:
      throw new ProjectValidationError(
        `Unsupported operation type "${String(operation.type)}" at position ${index + 1}.`,
        "unsupported-operation",
      );
  }
}

export function validateOperations(operations) {
  if (!Array.isArray(operations)) {
    throw new ProjectValidationError("Project operations must be an array.");
  }
  return operations.map(validateOperation);
}

const nowIso = () => new Date().toISOString();

export function createProject(operations, { editorMode = "text", metadata = {}, now = nowIso() } = {}) {
  const normalized = validateOperations(operations);
  if (editorMode !== "text" && editorMode !== "block") {
    throw new ProjectValidationError("editorMode must be text or block.");
  }
  const config = processOperations(normalized).config;
  return {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    editorMode,
    operations: normalized,
    metadata: {
      name: typeof metadata.name === "string" ? metadata.name : config.name,
      createdAt: typeof metadata.createdAt === "string" ? metadata.createdAt : now,
      updatedAt: now,
    },
  };
}

export function updateProject(project, operations, editorMode = project.editorMode, now = nowIso()) {
  const current = validateProject(project);
  const config = processOperations(validateOperations(operations)).config;
  return createProject(operations, {
    editorMode,
    now,
    metadata: {
      ...current.metadata,
      name: config.name,
      createdAt: current.metadata.createdAt,
    },
  });
}

export function validateProject(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new ProjectValidationError("This file is not a valid CCFEPub project.");
  }
  if (project.format !== PROJECT_FORMAT) {
    throw new ProjectValidationError("This file is not a valid CCFEPub project.", "wrong-format");
  }
  if (!Number.isInteger(project.formatVersion)) {
    throw new ProjectValidationError("Project formatVersion is missing or invalid.");
  }
  if (project.formatVersion > PROJECT_FORMAT_VERSION) {
    throw new ProjectValidationError(
      `This project uses newer formatVersion ${project.formatVersion}; this app supports version ${PROJECT_FORMAT_VERSION}.`,
      "newer-version",
    );
  }
  if (project.formatVersion !== PROJECT_FORMAT_VERSION) {
    throw new ProjectValidationError(`Unsupported project formatVersion ${project.formatVersion}.`, "unsupported-version");
  }
  const editorMode = project.editorMode ?? "text";
  if (editorMode !== "text" && editorMode !== "block") {
    throw new ProjectValidationError("Project editorMode must be text or block.");
  }
  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata : {};
  const operations = validateOperations(project.operations);
  const config = processOperations(operations).config;
  return {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    editorMode,
    operations,
    metadata: {
      name: typeof metadata.name === "string" ? metadata.name : config.name,
      createdAt: typeof metadata.createdAt === "string" ? metadata.createdAt : "",
      updatedAt: typeof metadata.updatedAt === "string" ? metadata.updatedAt : "",
    },
  };
}

export function serializeProject(project, spacing = 2) {
  return JSON.stringify(validateProject(project), null, spacing);
}

export function parseProjectJson(source) {
  let parsed;
  try {
    parsed = JSON.parse(String(source));
  } catch {
    throw new ProjectValidationError("This file does not contain valid JSON.", "invalid-json");
  }
  return validateProject(parsed);
}

export function loadStoredProject(storage) {
  const source = storage.getItem(PROJECT_STORAGE_KEY);
  return source ? parseProjectJson(source) : null;
}

export function saveProject(storage, project) {
  const normalized = validateProject(project);
  storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function migrateLegacyProject(storage, {
  preferredMode = "text",
  parseLegacyText,
  convertLegacyBlockly,
  now = nowIso(),
} = {}) {
  const warnings = [];
  const currentSource = storage.getItem(PROJECT_STORAGE_KEY);
  if (currentSource) {
    try {
      return { project: parseProjectJson(currentSource), migratedFrom: null, warnings };
    } catch (error) {
      return { project: null, migratedFrom: null, warnings: [error.message], blocked: true };
    }
  }

  const modes = preferredMode === "block" ? ["block", "text"] : ["text", "block"];
  for (const mode of modes) {
    try {
      let operations = null;
      if (mode === "text" && typeof parseLegacyText === "function") {
        const source = storage.getItem(LEGACY_TEXT_STORAGE_KEY);
        if (source) {
          const result = parseLegacyText(source);
          if (result.errors?.length) throw new Error("Legacy text contains command errors.");
          operations = result.operations;
        }
      }
      if (mode === "block" && typeof convertLegacyBlockly === "function") {
        const source = storage.getItem(LEGACY_BLOCK_STORAGE_KEY);
        if (source) operations = convertLegacyBlockly(source);
      }
      if (operations) {
        const project = createProject(operations, { editorMode: mode, now });
        saveProject(storage, project);
        return { project, migratedFrom: mode, warnings };
      }
    } catch (error) {
      warnings.push(`Could not migrate legacy ${mode} data: ${error.message}`);
    }
  }
  return { project: null, migratedFrom: null, warnings };
}
