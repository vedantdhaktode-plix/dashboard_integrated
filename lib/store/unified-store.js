import { EventEmitter } from "node:events";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { filterTasksForTeam, transitionTask } from "../workflow/engine";

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "unified-state.json");

const runtime = globalThis.__plixUnifiedRuntime || {
  emitter: new EventEmitter(),
  writeQueue: Promise.resolve(),
  sourceUsersPromise: null,
};
runtime.emitter.setMaxListeners(300);
globalThis.__plixUnifiedRuntime = runtime;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeStateFile(state) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryFile = `${STATE_FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(state, null, 2), "utf8");
  await rename(temporaryFile, STATE_FILE);
}

function dedupeUsers(...collections) {
  const users = new Map();
  for (const collection of collections) {
    for (const user of collection || []) users.set(user.id, { ...(users.get(user.id) || {}), ...user });
  }
  return [...users.values()];
}

async function getSourceUsers() {
  if (!runtime.sourceUsersPromise) {
    runtime.sourceUsersPromise = Promise.all([
      readJson(path.join(process.cwd(), "data", "workbook-data.json")),
      readJson(path.join(process.cwd(), "data", "mock-data.json")),
    ]).then(([workbookData, mockData]) => dedupeUsers(workbookData.users, mockData.users));
  }
  return runtime.sourceUsersPromise;
}

/**
 * Initializes state from mock-data and workbook-data if state file doesn't exist.
 */
async function createSeedState() {
  const [mockData, workbookData] = await Promise.all([
    readJson(path.join(process.cwd(), "data", "mock-data.json")),
    readJson(path.join(process.cwd(), "data", "workbook-data.json")),
  ]);

  const tasksMap = new Map();

  // Load operational fixture tasks first
  for (const task of mockData.tasks || []) {
    tasksMap.set(task.id, {
      ...task,
      hookName: task.hookName || task.title,
      stageDurations: task.stageDurations || [
        {
          stage: "brand_intake",
          team: "brand",
          iteration: 1,
          startedAt: task.updatedAt || new Date().toISOString(),
          completedAt: task.updatedAt || new Date().toISOString(),
          durationSeconds: 120,
          durationHours: 0.1,
        },
      ],
    });
  }

  // Load workbook tasks
  for (const task of workbookData.tasks || []) {
    if (!tasksMap.has(task.id)) {
      tasksMap.set(task.id, {
        ...task,
        hookName: task.hookName || task.title,
        stageDurations: task.stageDurations || [
          {
            stage: "brand_intake",
            team: "brand",
            iteration: 1,
            startedAt: task.updatedAt || new Date().toISOString(),
            completedAt: task.updatedAt || new Date().toISOString(),
            durationSeconds: 300,
            durationHours: 0.2,
          },
        ],
      });
    }
  }

  return {
    version: 1,
    revision: 1,
    updatedAt: new Date().toISOString(),
    tasks: Array.from(tasksMap.values()),
    users: dedupeUsers(workbookData.users, mockData.users),
    notifications: mockData.notifications || [],
  };
}

export async function getState() {
  try {
    const state = await readJson(STATE_FILE);
    return {
      ...state,
      // Preserve live user changes while restoring editor identities imported from the workbook.
      users: dedupeUsers(await getSourceUsers(), state.users),
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const seeded = await createSeedState();
    await writeStateFile(seeded);
    return seeded;
  }
}

/**
 * Mutates state atomically within a queue and emits a realtime change event.
 */
export async function mutateState(mutator, actor = "System") {
  const operation = runtime.writeQueue.then(async () => {
    const current = await getState();
    const tasks = structuredClone(current.tasks);
    const users = structuredClone(current.users);
    const notifications = structuredClone(current.notifications);

    const result = await mutator({ tasks, users, notifications, current });

    const nextState = {
      version: 1,
      revision: (current.revision || 1) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
      tasks,
      users,
      notifications,
    };

    await writeStateFile(nextState);

    runtime.emitter.emit("change", {
      type: "state.updated",
      revision: nextState.revision,
      updatedAt: nextState.updatedAt,
      actor,
    });

    return { state: nextState, result };
  });

  runtime.writeQueue = operation.catch(() => {});
  return operation;
}

export function subscribeToChanges(listener) {
  runtime.emitter.on("change", listener);
  return () => runtime.emitter.off("change", listener);
}

