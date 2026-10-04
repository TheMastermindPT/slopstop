// Throwaway prototype: PC-S1 "Add existing repository" flow. No product logic lives here.

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const ICON = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  warn: '<path d="M12 4 3 19.5h18Z"/><path d="M12 10v4.5"/><path d="M12 17.3v.1"/>',
  error: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8v.1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  minus: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6Z"/>',
  terminal:
    '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M7.5 10l3 2.5-3 2.5"/><path d="M12.5 15H16.5"/>',
  folder:
    '<path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9.5A1.5 1.5 0 0 0 19.5 8h-7.4L10 5.5H4.5A1.5 1.5 0 0 0 3 7Z"/>',
  eyeOff:
    '<path d="M4 4l16 16"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.8-1.2 2.2-2.6 3.5M6.6 7.7C4.6 9 3.3 11 3 12c.5 1.5 4 6 9 6 1.6 0 3-.4 4.2-1.1"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>',
  branch:
    '<circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="8" r="2"/><path d="M7 8v8"/><path d="M17 10c0 4-10 2-10 6"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

const GIT_PATHS = [
  "C:\\Program Files\\Git\\cmd\\git.exe",
  "C:\\Users\\pedro\\scoop\\apps\\git\\current\\cmd\\git.exe",
];
const GIT_VERSION = "git version 2.51.0.windows.1";

const QUERIES = [
  ["--is-inside-work-tree", "Is this a working folder?"],
  ["--is-bare-repository", "Is it a bare repository?"],
  ["--is-inside-git-dir", "Is it inside a .git folder?"],
  ["--path-format=absolute --show-toplevel", "Where does the working folder start?"],
  ["--absolute-git-dir", "Where is this folder's .git data?"],
  ["--path-format=absolute --git-common-dir", "Which repository does it share history with?"],
];

/** Each picker entry simulates one case. `at` = the stage where the outcome appears. */
const FOLDERS = [
  {
    name: "payments-api",
    path: "C:\\Users\\pedro\\code\\payments-api",
    sim: "Normal repository → registered",
    outcome: "registered",
    at: "confirm",
  },
  {
    name: "ragnarok-effect-hotfix",
    path: "C:\\Users\\pedro\\code\\ragnarok-effect-hotfix",
    sim: "Linked worktree of an existing Project",
    outcome: "worktree",
    at: "prepare",
  },
  {
    name: "ragnarok-effect",
    path: "C:\\Users\\pedro\\code\\ragnarok-effect",
    sim: "Already a Project",
    outcome: "already",
    at: "prepare",
  },
  {
    name: "chess",
    path: "C:\\Users\\pedro\\code\\chess",
    sim: "Existing Project: remove it from the list first to see it come back",
    outcome: "already",
    at: "prepare",
  },
  {
    name: "chess-engine",
    path: "C:\\Users\\pedro\\code\\chess-engine",
    sim: "Creation interrupted (crash) → incomplete",
    outcome: "incomplete",
    at: "confirm",
  },
  {
    name: "tools",
    path: "C:\\Users\\pedro\\code\\tools",
    sim: "Git updated before confirm → ask again",
    outcome: "gitChanged",
    at: "confirm",
  },
  {
    name: "invoices",
    path: "C:\\Users\\pedro\\code\\invoices",
    sim: "Registry busy on confirm (retry works)",
    outcome: "busy",
    at: "confirm",
  },
  {
    name: "scripts",
    path: "C:\\Users\\pedro\\code\\scripts",
    sim: "Git program missing at version check",
    outcome: "gitUnavailable",
    at: "git1",
  },
  {
    name: "old-notes",
    path: "C:\\Users\\pedro\\Documents\\old-notes",
    sim: "Plain folder, Git query fails",
    outcome: "queryFailed",
    at: "prepare",
  },
  {
    name: ".git",
    path: "C:\\Users\\pedro\\code\\payments-api\\.git",
    sim: "Inside a .git folder",
    outcome: "notWorkingTree",
    at: "prepare",
  },
  {
    name: "backup.git",
    path: "D:\\backups\\backup.git",
    sim: "Bare repository",
    outcome: "bare",
    at: "prepare",
  },
  {
    name: "moved-repo",
    path: "C:\\Users\\pedro\\code\\moved-repo",
    sim: "Deleted after selection",
    outcome: "notFound",
    at: "prepare",
  },
  {
    name: "locked-repo",
    path: "C:\\Users\\pedro\\code\\locked-repo",
    sim: "Access denied",
    outcome: "inaccessible",
    at: "prepare",
  },
  {
    name: "team-repo",
    path: "Z:\\shared\\team-repo",
    sim: "Network drive",
    outcome: "capability",
    at: "prepare",
  },
];

const STEPS = ["Folder", "Trust", "Git version", "Git access", "Confirm"];
const STEP_INDEX = { trust: 1, git1: 2, git2: 3, preparing: 4, proposal: 4 };

const BASE_PROJECTS = [
  { id: "ragnarok-effect", name: "ragnarok-effect", meta: "Storage healthy" },
  { id: "chess", name: "chess", meta: "Storage healthy" },
];

const cloneBase = () => BASE_PROJECTS.map((p) => ({ ...p }));

const state = {
  activeId: null,
  removeResult: "ok",
  platform: "windows",
  registry: "ok",
  projects: cloneBase(),
  flashId: null,
  gitPath: GIT_PATHS[0],
  gitGrant: false, // Git approval belongs to the executable, not to the folder.
  view: { kind: "idle" },
  pickerMode: "folder",
  pickerReturn: null,
};

/* ---------------- Projects list ---------------- */

function renderList() {
  const list = $("#project-list");
  const add = $("#btn-add");
  const hint = $("#add-hint");
  const broken = state.registry === "broken";
  const linux = state.platform === "linux";
  add.setAttribute("aria-disabled", String(broken || linux));
  // The OS is known at start-up, so Linux is explained before the folder dialog.
  hint.textContent = linux
    ? "Not available on Linux in this version. Adding repositories works on Windows only."
    : broken
      ? "Unavailable while saved Projects can't be read."
      : "Choose a Git repository folder on this computer.";
  hint.setAttribute("data-note", linux ? "Q14" : "Q1");
  hint.classList.toggle("is-blocked", linux || broken);
  hint.querySelector(".note-tag")?.remove();
  tagNotes(hint.parentElement);

  if (state.registry === "broken") {
    list.innerHTML = `
      <div class="list-problem is-broken" role="alert">
        <span class="title">${icon("error")} Saved Projects can't be read</span>
        <p>The Project registry is damaged or was written by a newer Ragnarok. Nothing was changed or reset.</p>
        <span class="code mono">Reference: REGISTRY_CORRUPT</span>
      </div>`;
    return;
  }
  if (state.registry === "busy") {
    list.innerHTML = `
      <div class="list-problem is-busy" role="status">
        <span class="title">${icon("clock")} Saved Projects are busy</span>
        <p>Another Ragnarok window is updating them. Use Refresh in a moment.</p>
        <span class="code mono">Reference: REGISTRY_BUSY</span>
      </div>`;
    return;
  }
  const visible = visibleProjects();
  if (visible.length === 0) {
    list.innerHTML =
      state.projects.length === 0
        ? `<p>No saved Projects yet. Add an existing repository to start.</p>`
        : `<p>No Projects in your list. Removed Projects come back when you add their folder again.</p>`;
    return;
  }
  list.innerHTML = `<ul class="project-list">${visible
    .map((p) => {
      const warn = p.incomplete;
      const active = p.id === state.activeId;
      const reason = active
        ? "Open now. Switch to another Project first to remove it."
        : warn
          ? "Needs recovery; it stays visible until recovered."
          : "";
      const reasonId = `reason-${p.id}`;
      return `<li class="row${active ? " is-active" : ""}">
        <button type="button" data-project="${esc(p.id)}" class="${p.id === state.flashId ? "is-flash" : ""}"
          aria-label="Open Project ${esc(p.name)}${p.isNew ? ", new" : ""}${warn ? ", registration incomplete" : ""}${active ? ", open now" : ""}"
          ${warn ? 'aria-disabled="true"' : ""} ${active ? 'aria-current="true"' : ""}>
          <strong>${esc(p.name)}</strong>
          <span class="meta ${warn ? "warn" : ""}">${warn ? icon("warn") : ""}${active ? "Open · " : ""}${esc(p.meta)}</span>
          ${p.isNew ? '<span class="badge">New</span>' : ""}
        </button>
        <button type="button" class="remove-btn" data-remove="${esc(p.id)}"
          aria-label="Remove ${esc(p.name)} from list" ${reason ? `aria-disabled="true" aria-describedby="${reasonId}"` : ""}>
          ${icon("eyeOff")}<span>Remove</span>
        </button>
        ${reason ? `<p class="row-reason" id="${reasonId}" data-note="${active ? "Q18" : ""}">${reason}</p>` : ""}
      </li>`;
    })
    .join("")}</ul>`;
  state.flashId = null;
  tagNotes(list);
}

const visibleProjects = () => state.projects.filter((p) => !p.hidden);

/* ---------------- Workspace views ---------------- */

function stepsBar(current) {
  return `<ol class="steps" aria-label="Progress">${STEPS.map((label, i) => {
    if (i < current)
      return `<li class="done">${icon("check")}<span>${label}<span class="sr-only"> (done)</span></span></li>`;
    if (i === current)
      return `<li aria-current="step"><span class="marker" aria-hidden="true">${i + 1}</span><span>${label}<span class="sr-only"> (current, step ${i + 1} of ${STEPS.length})</span></span></li>`;
    return `<li><span class="marker" aria-hidden="true">${i + 1}</span><span>${label}</span></li>`;
  }).join("")}</ol>`;
}

function flowFrame(stepKey, inner) {
  const top = stepKey
    ? `<p class="flow-title">Add existing repository</p>${stepsBar(STEP_INDEX[stepKey])}`
    : "";
  return `${top}<div class="step">${inner}</div>`;
}

const target = (k, name, path, ico = "folder") =>
  `<div class="target"><span class="k">${k}</span><span class="name">${icon(ico)}${esc(name)}</span><code>${esc(path)}</code></div>`;

const actions = (primary, opts = {}) => `
  <div class="actions">
    <button type="button" class="primary" data-act="${primary.act}" ${opts.busy ? "disabled" : ""} data-note="${primary.note || ""}">${primary.label}</button>
    <button type="button" data-act="cancel" ${opts.busy ? "disabled" : ""}>Cancel</button>
    <span class="kbd-hint">${opts.busy ? "Running — cannot be cancelled" : "Esc cancels"}</span>
  </div>`;

function viewIdle(v) {
  const note = v.note
    ? `<p class="cancel-note" role="status" data-note="${v.removed ? "" : "Q12"}">${icon("minus")}${esc(v.note)}</p>`
    : "";
  return `<div class="idle">${note}<h2 id="ws-heading" tabindex="-1">No Project selected</h2>
    <p>Choose a saved Project to open it${state.platform === "linux" ? "" : ", or add an existing repository"}. Access is checked when you open a Project.</p></div>`;
}

function viewOpened(v) {
  return `<div class="idle"><h2 id="ws-heading" tabindex="-1">Project ${esc(v.name)}</h2>
    <p>Opening a Project is outside this prototype. In the app this is the existing Project workspace.</p></div>`;
}

function viewTrust(f) {
  const next = state.gitGrant
    ? `Trusting runs nothing by itself. Next, Ragnarok identifies the repository with the Git program you already approved (${esc(GIT_VERSION.replace("git version ", "Git "))}).`
    : "Trusting runs nothing by itself. Next, you'll approve the Git program.";
  return flowFrame(
    "trust",
    `
    <h2 id="ws-heading" tabindex="-1" data-note="Q2">Do you trust this repository?</h2>
    <p class="lead">Confirm this before Ragnarok runs anything on it.</p>
    ${target("Selected folder", f.name, f.path)}
    <p>To identify the repository, Git reads its administration folder (<code>.git</code>) and its local configuration. That configuration can include other files, even ones outside this folder.</p>
    <div class="callout warn" data-note="Q3">
      ${icon("warn")}
      <strong>This version doesn't protect against a hostile Git configuration</strong>
      <p>An include in that configuration can make Windows connect to a network location, such as a shared drive. Only continue if you trust where this repository came from.</p>
    </div>
    <p>${next}</p>
    ${actions({ label: "Trust and continue", act: "trust" })}
    <p class="scope-note" data-note="Q4">This decision applies only to this folder. Choosing another folder asks again.</p>`,
  );
}

function viewGit1(f, busy) {
  return flowFrame(
    "git1",
    `
    <h2 id="ws-heading" tabindex="-1">Check the Git program</h2>
    <p class="lead">Ragnarok will run this Git program once, only to read its version.</p>
    ${target("Git program", "git.exe", state.gitPath, "terminal")}
    <p><button type="button" class="link" data-act="choose-git" ${busy ? "disabled" : ""} data-note="Q5">Choose a different Git program…</button></p>
    <p>Command: <code class="command">git --version</code></p>
    <p>It runs outside the repository, so nothing in <strong>${esc(f.name)}</strong> is read yet.</p>
    ${busy ? `<p class="busy-line" role="status"><span class="spinner" aria-hidden="true"></span>Checking the Git version…</p>` : ""}
    ${actions({ label: "Run version check", act: "git1" }, { busy })}`,
  );
}

function queryList(progress) {
  return `<ol class="queries" data-note="Q6">${QUERIES.map(([q, why], i) => {
    let cls = "";
    let mark = String(i + 1);
    let sr = "";
    if (progress !== undefined) {
      if (i < progress) {
        cls = "is-done";
        mark = icon("check");
        sr = " (done)";
      } else if (i === progress) {
        cls = "is-running";
        sr = " (running)";
      }
    }
    return `<li class="${cls}"><span class="n" aria-hidden="true">${mark}</span><code>git rev-parse ${esc(q)}<span class="sr-only">${sr}</span></code><span>${esc(why)}</span></li>`;
  }).join("")}</ol>`;
}

function viewGit2(f) {
  return flowFrame(
    "git2",
    `
    <h2 id="ws-heading" tabindex="-1">Allow Git to identify ${esc(f.name)}?</h2>
    <p class="lead">Ragnarok needs six read-only Git queries to recognise this repository and to check whether it already belongs to a Project.</p>
    <dl class="facts">
      <dt>Git program</dt><dd><code>${esc(state.gitPath)}</code></dd>
      <dt>Observed version</dt><dd><code>${esc(GIT_VERSION)}</code></dd>
      <dt>Runs in</dt><dd>${esc(f.name)}</dd>
    </dl>
    ${queryList()}
    <p>These queries only read. Ragnarok does not ask Git to change files, run hooks or contact remotes. The configuration warning you accepted still applies.</p>
    ${actions({ label: "Allow 6 queries", act: "git2", note: "Q7" })}
    <p class="scope-note">This approval covers this Git program and version. If either changes, Ragnarok asks again.</p>`,
  );
}

function viewPreparing(f, progress) {
  return flowFrame(
    "preparing",
    `
    <h2 id="ws-heading" tabindex="-1">Identifying ${esc(f.name)}…</h2>
    <p class="busy-line" role="status"><span class="spinner" aria-hidden="true"></span>Running read-only queries: ${Math.min(progress + 1, 6)} of 6</p>
    ${queryList(progress)}
    ${actions({ label: "Confirm registration", act: "confirm" }, { busy: true })}`,
  );
}

function viewProposal(f, busy) {
  return flowFrame(
    "proposal",
    `
    <h2 id="ws-heading" tabindex="-1">Ready to add ${esc(f.name)}</h2>
    <p class="lead">Check the details, then confirm.</p>
    <dl class="facts">
      <dt>Project name</dt><dd>${esc(f.name)} <span class="hint-inline">from the folder name</span></dd>
      <dt>Repository folder</dt><dd><code>${esc(f.path)}</code></dd>
      <dt>Working tree</dt><dd>Main working tree</dd>
      <dt>Git</dt><dd>${esc(GIT_VERSION.replace("git version ", ""))}</dd>
    </dl>
    <div class="callout">
      ${icon("info")}
      <strong>What confirming does</strong>
      <p>Ragnarok creates a Project and its storage on this computer. Your repository is not changed.</p>
    </div>
    <p>Just before creating the Project, Ragnarok checks the folder and Git again.</p>
    ${busy ? `<p class="busy-line" role="status"><span class="spinner" aria-hidden="true"></span>Checking again and creating the Project…</p>` : ""}
    ${actions({ label: "Confirm registration", act: "confirm", note: "Q8" }, { busy })}`,
  );
}

/* ---------------- Outcomes ---------------- */

const OUTCOMES = {
  registered: (f) => ({
    tone: "success",
    word: "Added",
    icon: "check",
    title: `${f.name} was added`,
    body: ["It is now in your Projects list. Opening it checks access to its local storage."],
    actions: [
      { label: "Open Project", act: "open-new", primary: true },
      { label: "Add another repository", act: "add" },
    ],
  }),
  worktree: () => ({
    tone: "neutral",
    word: "Not added",
    icon: "branch",
    note: "Q10",
    title: "This worktree is part of a Project you already have",
    body: [
      "This worktree belongs to Project ragnarok-effect. Adding further worktrees is not supported yet.",
    ],
    nothing: "Nothing was created or changed.",
    actions: [
      { label: "Show ragnarok-effect", act: "show:ragnarok-effect", primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  already: (f) => ({
    tone: "neutral",
    word: "Already registered",
    icon: "info",
    note: "Q17",
    title: `${f.name} is already registered`,
    body: [`This folder already belongs to Project ${f.name}. No second Project was created.`],
    actions: [
      { label: `Open ${f.name}`, act: `open:${f.name}`, primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  incomplete: (f) => ({
    tone: "warn",
    word: "Needs recovery",
    icon: "warn",
    note: "Q11",
    title: `Adding ${f.name} was interrupted`,
    body: [
      "Ragnarok stopped before the Project was fully created. It appears in your list as “Registration incomplete”.",
      "Recovery is not available in this version, so this repository stays blocked for now. Nothing was deleted.",
    ],
    code: "REGISTRATION_INCOMPLETE",
    actions: [
      { label: "Show it in the list", act: `show:${f.name}`, primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  restored: (f) => ({
    tone: "success",
    word: "Back in your list",
    icon: "check",
    note: "Q20",
    title: `${f.name} is back in your list`,
    body: [
      "This folder was already registered, so Ragnarok brought back the same Project with its saved data. No second Project was created.",
    ],
    actions: [
      { label: `Open ${f.name}`, act: `open:${f.name}`, primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  removeBusy: (f) => ({
    tone: "warn",
    word: "Busy",
    icon: "clock",
    title: `${f.name} wasn't removed`,
    body: ["Another Ragnarok window is updating your Projects. Wait a moment, then try again."],
    nothing: "Your list was not changed.",
    code: "REGISTRY_BUSY",
    actions: [
      { label: "Try again", act: "remove-retry", primary: true },
      { label: "Cancel", act: "remove-cancel" },
    ],
  }),
  removeBroken: (f) => ({
    tone: "error",
    word: "Not removed",
    icon: "error",
    title: "Saved Projects can't be updated",
    body: [
      `${f.name} is still in your list. The Project registry is damaged or was written by a newer Ragnarok, so nothing was removed, changed or reset.`,
    ],
    code: "REGISTRY_CORRUPT",
    actions: [{ label: "Back to Projects", act: "remove-cancel", primary: true }],
  }),
  notFound: () => ({
    tone: "error",
    word: "Not added",
    icon: "error",
    title: "The selected folder can't be found",
    body: ["It may have been moved, renamed or deleted after you chose it."],
    nothing: "Nothing was created.",
    code: "REPOSITORY_NOT_FOUND",
    actions: [
      { label: "Choose another folder", act: "add", primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  inaccessible: () => ({
    tone: "error",
    word: "Not added",
    icon: "error",
    title: "Ragnarok can't open this folder",
    body: ["Windows denied access to it. Check the folder's permissions, then try again."],
    nothing: "Nothing was created.",
    code: "REPOSITORY_INACCESSIBLE",
    actions: [
      { label: "Try again", act: "retry-prepare", primary: true },
      { label: "Choose another folder", act: "add" },
    ],
  }),
  notWorkingTree: () => ({
    tone: "error",
    word: "Not added",
    icon: "error",
    title: "This folder is inside a .git folder",
    body: ["Choose the repository's working folder instead: the one that contains your files."],
    nothing: "Nothing was created.",
    code: "NOT_WORKING_TREE",
    actions: [
      { label: "Choose another folder", act: "add", primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  bare: () => ({
    tone: "error",
    word: "Not added",
    icon: "error",
    title: "This is a bare repository",
    body: [
      "A bare repository has no working files, so it can't be added as a Project. Choose a folder with checked-out files.",
    ],
    nothing: "Nothing was created.",
    code: "BARE_REPOSITORY",
    actions: [
      { label: "Choose another folder", act: "add", primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  queryFailed: () => ({
    tone: "error",
    word: "Not added",
    icon: "error",
    note: "Q13",
    title: "Git couldn't read this folder as a repository",
    body: [
      "The folder may not be a Git repository, or Git may have refused its configuration. Git's own messages are not shown here.",
    ],
    nothing: "Nothing was created.",
    code: "GIT_QUERY_FAILED",
    actions: [
      { label: "Choose another folder", act: "add", primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  capability: () => ({
    tone: "error",
    word: "Not supported",
    icon: "error",
    title: "Ragnarok can't identify this drive reliably",
    body: [
      "Projects need a local drive whose folders keep a stable identity. Network and virtual drives are not supported in this version.",
    ],
    nothing: "Nothing was created.",
    code: "IDENTITY_CAPABILITY_UNAVAILABLE",
    actions: [
      { label: "Choose another folder", act: "add", primary: true },
      { label: "Back to Projects", act: "back" },
    ],
  }),
  gitChanged: () => ({
    tone: "warn",
    word: "Confirmation needed",
    icon: "shield",
    title: "Confirm Git again",
    body: [
      "The Git program changed since you approved it, for example after an update. Ragnarok won't run it until you check it again.",
    ],
    nothing: "Nothing was created.",
    code: "GIT_CONFIRMATION_REQUIRED",
    actions: [
      { label: "Check Git again", act: "regit", primary: true },
      { label: "Cancel", act: "cancel" },
    ],
  }),
  gitUnavailable: () => ({
    tone: "error",
    word: "Git unavailable",
    icon: "error",
    title: "Git can't be started",
    body: [
      "The approved Git program could not be found or started. Install Git, or choose a different Git program.",
    ],
    nothing: "Nothing in the repository was read.",
    code: "GIT_UNAVAILABLE",
    actions: [
      { label: "Choose Git program", act: "regit", primary: true },
      { label: "Cancel", act: "cancel" },
    ],
  }),
  busy: () => ({
    tone: "warn",
    word: "Busy",
    icon: "clock",
    title: "Projects are busy",
    body: ["Another Ragnarok window is updating your Projects. Wait a moment, then try again."],
    nothing: "Nothing was created.",
    code: "REGISTRY_BUSY",
    actions: [
      { label: "Try again", act: "retry-confirm", primary: true },
      { label: "Cancel", act: "cancel" },
    ],
  }),
};

function viewOutcome(key, f) {
  const o = OUTCOMES[key](f || FOLDERS[0]);
  return `<div class="step tone-${o.tone}">
    <div class="outcome-head">${icon(o.icon)}<div>
      <span class="status-word">${o.word}</span>
      <h2 id="ws-heading" tabindex="-1" data-note="${o.note || ""}">${esc(o.title)}</h2>
    </div></div>
    ${o.body.map((p) => `<p class="lead">${esc(p)}</p>`).join("")}
    ${o.nothing ? `<p class="nothing">${icon("minus")}${esc(o.nothing)}</p>` : ""}
    <div class="actions">${o.actions
      .map(
        (a) =>
          `<button type="button" class="${a.primary ? "primary" : ""}" data-act="${esc(a.act)}">${esc(a.label)}</button>`,
      )
      .join("")}</div>
    ${o.code ? `<p class="code-line mono" data-note="Q9">Reference: ${o.code}</p>` : ""}
  </div>`;
}

function viewRemove(v) {
  const fx = [
    ["minus", "It disappears from your Projects list."],
    ["check", "Its Ragnarok data stays saved on this computer."],
    ["check", "The repository and its files are not changed."],
    [
      "info",
      "Adding the same folder again brings this Project back: the same Project, not a copy.",
    ],
  ];
  return `<div class="step">
    <p class="flow-title">Remove from list</p>
    <h2 id="ws-heading" tabindex="-1" data-note="Q21">Remove ${esc(v.name)} from the list?</h2>
    <ul class="effects">${fx.map(([i, t]) => `<li>${icon(i)}<span>${t}</span></li>`).join("")}</ul>
    ${v.busy ? `<p class="busy-line" role="status"><span class="spinner" aria-hidden="true"></span>Removing from the list…</p>` : ""}
    <div class="actions">
      <button type="button" class="primary" data-act="remove-confirm" ${v.busy ? "disabled" : ""} data-note="Q22">Remove from list</button>
      <button type="button" data-act="remove-cancel" ${v.busy ? "disabled" : ""}>Cancel</button>
      <span class="kbd-hint">${v.busy ? "Running — cannot be cancelled" : "Esc cancels"}</span>
    </div>
  </div>`;
}

/* ---------------- Rendering + focus ---------------- */

function render({ focus = "heading" } = {}) {
  const v = state.view;
  const ws = $("#workspace");
  const views = {
    idle: () => viewIdle(v),
    opened: () => viewOpened(v),
    trust: () => viewTrust(v.folder),
    git1: () => viewGit1(v.folder, v.busy),
    git2: () => viewGit2(v.folder),
    preparing: () => viewPreparing(v.folder, v.progress),
    proposal: () => viewProposal(v.folder, v.busy),
    outcome: () => viewOutcome(v.outcome, v.folder),
    remove: () => viewRemove(v),
  };
  ws.innerHTML = views[v.kind]();
  ws.setAttribute("aria-busy", String(Boolean(v.busy || v.kind === "preparing")));
  renderList();
  tagNotes(document);
  requestAnimationFrame(() => {
    if (focus === "heading") $("#ws-heading")?.focus();
    else if (focus === "add") $("#btn-add").focus();
    else if (focus?.startsWith("project:"))
      document.querySelector(`[data-project="${focus.slice(8)}"]`)?.focus();
    else if (focus?.startsWith("remove:"))
      document.querySelector(`[data-remove="${focus.slice(7)}"]`)?.focus();
  });
}

function tagNotes(root) {
  root.querySelectorAll("[data-note]").forEach((el) => {
    const id = el.getAttribute("data-note");
    if (!id || el.querySelector(":scope > .note-tag")) return;
    el.insertAdjacentHTML("beforeend", `<span class="note-tag" aria-hidden="true">${id}</span>`);
  });
}

function announce(text) {
  const a = $("#announcer");
  a.textContent = "";
  setTimeout(() => {
    a.textContent = text;
  }, 30);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let runToken = 0;

/* ---------------- Flow actions ---------------- */

function go(kind, extra = {}, renderOpts) {
  state.view = { ...state.view, ...extra, kind, busy: false };
  render(renderOpts);
}

function outcome(key) {
  if (key === "incomplete") addProject(state.view.folder, { incomplete: true });
  if (key === "registered") addProject(state.view.folder, { isNew: true });
  if (key === "restored") {
    const p = state.projects.find((x) => x.id === state.view.folder.name);
    if (p) {
      p.hidden = false;
      state.flashId = p.id;
    }
  }
  if (key === "gitChanged" || key === "gitUnavailable") state.gitGrant = false;
  go("outcome", { outcome: key });
  const o = OUTCOMES[key](state.view.folder || FOLDERS[0]);
  announce(`${o.word}. ${o.title}`);
}

function addProject(f, flags) {
  state.projects = state.projects.filter((p) => p.id !== f.name);
  state.projects.unshift({
    id: f.name,
    name: f.name,
    meta: flags.incomplete ? "Registration incomplete — recovery required" : "Storage healthy",
    ...flags,
  });
  state.flashId = f.name;
}

function cancelFlow(note) {
  runToken++;
  state.view = { kind: "idle", note };
  render({ focus: "add" });
  announce(note);
}

const CANCEL_NOTES = {
  trust: "Cancelled. Nothing was run.",
  git1: "Cancelled. Git was not run.",
  git2: "Cancelled. Git only read its own version; no repository query was run.",
  proposal: "Cancelled. Nothing was created.",
  outcome: "Cancelled. Nothing was created.",
};

async function runGit1() {
  const t = ++runToken;
  state.view.busy = true;
  render();
  await wait(900);
  if (t !== runToken) return;
  if (state.view.folder.outcome === "gitUnavailable" && state.view.folder.at === "git1")
    return outcome("gitUnavailable");
  go("git2");
}

async function runPrepare() {
  const t = ++runToken;
  state.gitGrant = true;
  state.view = { ...state.view, kind: "preparing", progress: 0, busy: true };
  render();
  for (let i = 1; i <= 6; i++) {
    await wait(380);
    if (t !== runToken) return;
    state.view.progress = i;
    if (i < 6) updateProgress(i);
  }
  const f = state.view.folder;
  // Re-adding a removed Project's folder brings back the same Project.
  const removed = state.projects.find((p) => p.id === f.name && p.hidden);
  if (removed) return outcome("restored");
  if (f.at === "prepare") return outcome(f.outcome);
  go("proposal");
  announce(`Ready to add ${f.name}.`);
}

async function runConfirm() {
  const t = ++runToken;
  state.view.busy = true;
  render();
  await wait(1000);
  if (t !== runToken) return;
  const f = state.view.folder;
  if (f.retried && f.outcome === "busy") return outcome("registered");
  outcome(f.at === "confirm" ? f.outcome : "registered");
}

function startRemove(btn) {
  const id = btn.dataset.remove;
  if (btn.getAttribute("aria-disabled") === "true") {
    return announce(
      id === state.activeId
        ? "This Project is open. Switch to another Project first to remove it."
        : "This Project needs recovery; it stays visible until recovered.",
    );
  }
  runToken++;
  state.view = { kind: "remove", projectId: id, name: id, retried: false };
  render();
}

function cancelRemove() {
  const id = state.view.projectId;
  runToken++;
  state.view = { kind: "idle" };
  render({ focus: `remove:${id}` });
}

async function runRemove() {
  const t = ++runToken;
  const v = state.view;
  v.busy = true;
  render();
  await wait(700);
  if (t !== runToken) return;
  const failure = v.retried ? "ok" : state.removeResult;
  if (failure !== "ok") {
    const key = failure === "busy" ? "removeBusy" : "removeBroken";
    go("outcome", { outcome: key, folder: { name: v.name } });
    const o = OUTCOMES[key]({ name: v.name });
    return announce(`${o.word}. ${o.title}`);
  }
  const list = visibleProjects();
  const i = list.findIndex((p) => p.id === v.projectId);
  const next = list[i + 1] || list[i - 1];
  state.projects.find((p) => p.id === v.projectId).hidden = true;
  const note = `${v.name} was removed from the list. Its data is still saved; adding its folder again brings it back.`;
  state.view = { kind: "idle", note, removed: true };
  render({ focus: next ? `project:${next.id}` : "add" });
  announce(note);
}

/** Updates progress in place so keyboard focus stays on the heading. */
function updateProgress(i) {
  const ws = $("#workspace");
  ws.querySelector(".queries").outerHTML = queryList(i);
  ws.querySelector(".busy-line").lastChild.textContent = `Running read-only queries: ${i + 1} of 6`;
  tagNotes(ws);
}

function startAdd() {
  if (state.registry === "broken") {
    announce("Adding is unavailable while saved Projects can't be read.");
    return;
  }
  if (state.platform === "linux") {
    announce("Adding repositories isn't available on Linux in this version.");
    return;
  }
  openPicker("folder", "#btn-add");
}

function selectFolder(f) {
  runToken++;
  // A new selection always starts with its own trust decision.
  state.view = { kind: "trust", folder: { ...f, retried: false } };
  render();
}

function handleAct(act, btn) {
  const v = state.view;
  if (act === "cancel") return cancelFlow(CANCEL_NOTES[v.kind] || CANCEL_NOTES.outcome);
  if (act === "trust") return state.gitGrant ? runPrepare() : go("git1");
  if (act === "git1") return runGit1();
  if (act === "git2") return runPrepare();
  if (act === "confirm") return runConfirm();
  if (act === "choose-git") return openPicker("git", btn);
  if (act === "add") return startAdd();
  if (act === "back") {
    state.view = { kind: "idle" };
    return render({ focus: "add" });
  }
  if (act === "regit") return go("git1", { folder: { ...v.folder, at: "none" } });
  if (act === "retry-prepare") {
    state.view.folder = { ...v.folder, outcome: "registered", at: "confirm" };
    return runPrepare();
  }
  if (act === "retry-confirm") {
    state.view.folder = { ...v.folder, retried: true };
    state.view.kind = "proposal";
    return runConfirm();
  }
  if (act === "open-new") return openProject(v.folder.name);
  if (act.startsWith("open:")) return openProject(act.slice(5));
  if (act === "remove-confirm") return runRemove();
  if (act === "remove-cancel") return cancelRemove();
  if (act === "remove-retry") {
    state.view = { ...v, kind: "remove", retried: true };
    return runRemove();
  }
  if (act.startsWith("show:")) {
    const id = act.slice(5);
    state.view = { kind: "idle" };
    return render({ focus: `project:${id}` });
  }
}

function openProject(id) {
  state.activeId = id;
  state.view = { kind: "opened", name: id };
  render();
}

/* ---------------- OS picker placeholder ---------------- */

function openPicker(mode, returnSel) {
  state.pickerMode = mode;
  state.pickerReturn = returnSel;
  const dlg = $("#os-picker");
  $("#os-picker-title").textContent = mode === "git" ? "Select Git program" : "Select folder";
  const items =
    mode === "git"
      ? GIT_PATHS.map(
          (p, i) =>
            `<li><button type="button" data-pick="${i}"><span>git.exe</span><span class="p">${esc(p)}</span></button></li>`,
        )
      : FOLDERS.map(
          (f, i) =>
            `<li><button type="button" data-pick="${i}"><span>${esc(f.name)}</span><span class="p">${esc(f.path)}</span><span class="sim">Simulates: ${esc(f.sim)}</span></button></li>`,
        );
  $("#os-list").innerHTML = items.join("");
  dlg.showModal();
  dlg.querySelector("[data-pick]").focus();
}

function closePicker(picked) {
  const dlg = $("#os-picker");
  dlg.close();
  const ret = state.pickerReturn;
  if (picked === null) {
    // Cancelling the native picker changes nothing and returns focus to its trigger.
    const el = typeof ret === "string" ? $(ret) : ret;
    (el && document.body.contains(el) ? el : $("#btn-add")).focus();
    return;
  }
  if (state.pickerMode === "git") {
    const changed = state.gitPath !== GIT_PATHS[picked];
    state.gitPath = GIT_PATHS[picked];
    if (changed) state.gitGrant = false;
    render();
    announce("Git program changed. Run the version check for it.");
  } else {
    selectFolder(FOLDERS[picked]);
  }
}

/* ---------------- Wiring ---------------- */

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.id === "btn-add") return startAdd();
  if (btn.id === "os-cancel") return closePicker(null);
  if (btn.dataset.pick !== undefined) return closePicker(Number(btn.dataset.pick));
  if (btn.dataset.project) {
    if (btn.getAttribute("aria-disabled") === "true")
      return announce("This Project's registration is incomplete. Recovery isn't available yet.");
    return openProject(btn.dataset.project);
  }
  if (btn.dataset.remove) return startRemove(btn);
  if (btn.id === "btn-refresh") {
    if (state.registry === "busy") {
      state.registry = "ok";
      $("#ctl-registry").value = "ok";
    }
    renderList();
    return announce(
      state.registry === "broken" ? "Saved Projects still can't be read." : "Projects refreshed.",
    );
  }
  if (btn.id === "rail-projects") return $("#projects-heading").focus();
  if (btn.dataset.act && !btn.disabled) void handleAct(btn.dataset.act, btn);
});

$("#os-picker").addEventListener("cancel", (e) => {
  e.preventDefault();
  closePicker(null);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || $("#os-picker").open) return;
  const v = state.view;
  const removing =
    v.kind === "remove" ||
    (v.kind === "outcome" && ["removeBusy", "removeBroken"].includes(v.outcome));
  if (removing && !v.busy) {
    e.preventDefault();
    return cancelRemove();
  }
  const cancellable =
    ["trust", "git1", "git2", "proposal"].includes(v.kind) ||
    (v.kind === "outcome" && ["gitChanged", "busy", "gitUnavailable"].includes(v.outcome));
  if (cancellable && !v.busy) {
    e.preventDefault();
    cancelFlow(CANCEL_NOTES[v.kind] || CANCEL_NOTES.outcome);
  }
});

$("#ctl-platform").addEventListener("change", (e) => {
  state.platform = e.target.value;
  renderList();
});
$("#ctl-registry").addEventListener("change", (e) => {
  state.registry = e.target.value;
  state.projects = e.target.value === "empty" ? [] : cloneBase();
  renderList();
});
$("#ctl-remove").addEventListener("change", (e) => {
  state.removeResult = e.target.value;
});
$("#ctl-notes").addEventListener("change", (e) =>
  document.body.classList.toggle("notes-on", e.target.checked),
);
$("#ctl-reset").addEventListener("click", () => {
  runToken++;
  Object.assign(state, {
    activeId: null,
    removeResult: "ok",
    platform: "windows",
    registry: "ok",
    projects: cloneBase(),
    gitGrant: false,
    gitPath: GIT_PATHS[0],
    view: { kind: "idle" },
  });
  $("#ctl-platform").value = "windows";
  $("#ctl-registry").value = "ok";
  $("#ctl-remove").value = "ok";
  render({ focus: "add" });
});
$("#ctl-jump").addEventListener("change", (e) => {
  const val = e.target.value;
  e.target.value = "";
  if (!val) return;
  runToken++;
  state.gitGrant = false;
  if (val.startsWith("r:")) {
    state.registry = "ok";
    $("#ctl-registry").value = "ok";
    state.projects = cloneBase();
    if (val === "r:blocked") {
      state.activeId = "ragnarok-effect";
      state.view = { kind: "opened", name: "ragnarok-effect" };
      return render({ focus: "remove:ragnarok-effect" });
    }
    state.activeId = null;
    if (val !== "r:confirm") {
      state.removeResult = val.slice(2);
      $("#ctl-remove").value = state.removeResult;
    }
    state.view = { kind: "remove", projectId: "chess", name: "chess", retried: false };
    if (val === "r:confirm") return render();
    return runRemove();
  }
  if (val === "o:restored") {
    state.projects = cloneBase();
    state.projects.find((p) => p.id === "chess").hidden = true;
  }
  const byOutcome = (k) =>
    (k === "restored"
      ? FOLDERS.find((f) => f.name === "chess")
      : FOLDERS.find((f) => f.outcome === k)) || FOLDERS[0];
  if (val.startsWith("o:")) {
    const key = val.slice(2);
    state.view = { kind: "proposal", folder: { ...byOutcome(key) } };
    return outcome(key);
  }
  const f = { ...FOLDERS[0] };
  if (val === "preparing") {
    state.view = { kind: "git2", folder: f };
    return runPrepare();
  }
  state.view = { kind: val, folder: f };
  render();
});

render({ focus: null });
