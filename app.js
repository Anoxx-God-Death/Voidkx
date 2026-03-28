// ============================================================
// void.kx — app.js
// Main controller + UI + background canvas
// ============================================================

// ── State ────────────────────────────────────────────────────
let state = {
running: false,
agents: [],
opinions: [],
phase: “idle”, // idle | spawning | analyzing | debating | synthesizing | done
};

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
topicInput:       $(“topicInput”),
charCount:        $(“charCount”),
agentSlider:      $(“agentSlider”),
agentVal:         $(“agentVal”),
launchBtn:        $(“launchBtn”),
resetBtn:         $(“resetBtn”),
statusDot:        $(“statusDot”),
statusText:       $(“statusText”),
progressBlock:    $(“progressBlock”),
progressLabel:    $(“progressLabel”),
progressFill:     $(“progressFill”),
progressPhases:   $(“progressPhases”),
subjectPill:      $(“subjectPill”),
pillText:         $(“pillText”),
agentsSection:    $(“agentsSection”),
agentsLabel:      $(“agentsLabel”),
agentsGrid:       $(“agentsGrid”),
liveBadge:        $(“liveBadge”),
debateSection:    $(“debateSection”),
debateFeed:       $(“debateFeed”),
synthesisSection: $(“synthesisSection”),
synthesisCard:    $(“synthesisCard”),
synthesisContent: $(“synthesisContent”),
heroBlock:        $(“heroBlock”),
newSimBtn:        $(“newSimBtn”),
copyBtn:          $(“copyBtn”),
};

// ── Slider ────────────────────────────────────────────────────
els.agentSlider.addEventListener(“input”, () => {
els.agentVal.textContent = els.agentSlider.value;
});

// ── Char counter ──────────────────────────────────────────────
els.topicInput.addEventListener(“input”, () => {
els.charCount.textContent = els.topicInput.value.length;
});

// ── Launch ────────────────────────────────────────────────────
els.launchBtn.addEventListener(“click”, runSwarm);
els.topicInput.addEventListener(“keydown”, e => {
if (e.ctrlKey && e.key === “Enter”) runSwarm();
});

// ── Reset ─────────────────────────────────────────────────────
els.resetBtn.addEventListener(“click”, resetAll);
els.newSimBtn.addEventListener(“click”, resetAll);

// ── Copy report ───────────────────────────────────────────────
els.copyBtn.addEventListener(“click”, () => {
const text = els.synthesisContent.innerText;
navigator.clipboard.writeText(text).then(() => {
els.copyBtn.textContent = “✓ COPIED”;
setTimeout(() => els.copyBtn.textContent = “⎘ COPY REPORT”, 2000);
});
});

// ── Main swarm runner ─────────────────────────────────────────
async function runSwarm() {
const topic = els.topicInput.value.trim();
if (!topic || state.running) return;

const agentCount = parseInt(els.agentSlider.value);
state.running = true;

// Hide hero, show running UI
els.heroBlock.classList.add(“hidden”);
els.launchBtn.disabled = true;
els.resetBtn.classList.remove(“hidden”);

setStatus(“running”, “SPAWNING SWARM…”);
showProgress([“SPAWN”, “ANALYZE”, “DEBATE”, “SYNTHESIZE”], 0);

// Show subject pill
els.pillText.textContent = topic.length > 160 ? topic.slice(0, 160) + “…” : topic;
els.subjectPill.classList.remove(“hidden”);

// ── Phase 1: Spawn agents ──
setProgressLabel(“SPAWNING “ + agentCount + “ AGENTS…”);
setProgressFill(5);

let agents;
try {
agents = await generateAgents(topic, agentCount);
} catch (e) {
showError(“Agent generation failed: “ + e.message);
return;
}

state.agents = agents;

// Render agent cards (empty)
els.agentsSection.classList.remove(“hidden”);
els.agentsLabel.textContent = `AGENT SWARM [${agents.length} UNITS]`;
els.agentsGrid.innerHTML = “”;
agents.forEach((agent, i) => {
els.agentsGrid.appendChild(buildAgentCard(agent, i));
});
els.liveBadge.classList.remove(“hidden”);

setPhaseActive(0);
setProgressFill(20);
scrollTo(els.agentsSection);

// ── Phase 2: Analyze in parallel ──
setProgressLabel(“RUNNING AGENTS IN PARALLEL…”);
setStatus(“running”, “AGENTS ANALYZING…”);
setPhaseActive(1);

const opinions = new Array(agents.length).fill(””);

try {
await getAllOpinions(agents, topic, (i, opinion) => {
opinions[i] = opinion;
updateAgentOpinion(i, opinion);
const done = opinions.filter(Boolean).length;
setProgressFill(20 + Math.round((done / agents.length) * 35));
setProgressLabel(`ANALYZING: ${done}/${agents.length} AGENTS COMPLETE`);
});
} catch (e) {
showError(“Analysis failed: “ + e.message);
return;
}

state.opinions = opinions;
els.liveBadge.classList.add(“hidden”);
setPhaseActive(1, true);
setProgressFill(55);

// ── Phase 3: Debate ──
setProgressLabel(“GENERATING DEBATE FEED…”);
setStatus(“running”, “AGENTS DEBATING…”);
setPhaseActive(2);

els.debateSection.classList.remove(“hidden”);
scrollTo(els.debateSection);

let debate = [];
try {
debate = await generateDebate(agents, opinions, topic);
} catch (e) {
// debate is optional, continue
}

debate.forEach((msg, idx) => {
setTimeout(() => {
const agentIdx = Math.min(msg.agentIndex, agents.length - 1);
els.debateFeed.appendChild(buildDebateMsg(agents[agentIdx], msg.text, idx));
}, idx * 300);
});

await sleep(debate.length * 300 + 400);
setPhaseActive(2, true);
setProgressFill(75);

// ── Phase 4: Synthesize ──
setProgressLabel(“SYNTHESIZING COLLECTIVE INTELLIGENCE…”);
setStatus(“running”, “SYNTHESIZING…”);
setPhaseActive(3);

els.synthesisSection.classList.remove(“hidden”);
scrollTo(els.synthesisSection);

let report = “”;
try {
report = await synthesizeReport(agents, opinions, topic);
} catch (e) {
showError(“Synthesis failed: “ + e.message);
return;
}

renderReport(report);
setProgressFill(100);
setPhaseActive(3, true);

// ── Done ──
setStatus(“done”, “SIMULATION COMPLETE”);
setProgressLabel(“✓ COMPLETE”);
state.running = false;
scrollTo(els.synthesisSection);
}

// ── Build agent card DOM ──────────────────────────────────────
function buildAgentCard(agent, index) {
const s = agent.style;
const card = document.createElement(“div”);
card.className = “agent-card”;
card.id = `agent-card-${index}`;
card.style.cssText = `--card-color:${s.color}; animation-delay:${index * 0.08}s;`;
card.style.borderColor = `${s.color}22`;

// Left accent bar via ::before
const style = document.createElement(“style”);
style.textContent = `#agent-card-${index}::before { background: ${s.color}; }`;
document.head.appendChild(style);

card.innerHTML = `<div class="agent-header"> <div class="agent-icon" style="color:${s.color}; text-shadow:0 0 12px ${s.shadow}">${s.icon}</div> <div> <div class="agent-name" style="color:${s.color}">${agent.name}</div> <div class="agent-meta">${agent.role} · ${agent.bias}</div> </div> <div class="agent-status" id="agent-status-${index}"> ${[0,1,2].map((j) =>`
<div class="agent-status-dot" style="background:${s.color}; --d:${j*0.2}s"></div>
`).join("")} </div> </div> <div class="agent-opinion" id="agent-opinion-${index}"> <div class="agent-thinking"> ${[0,1,2].map(j => `<div class="think-dot" style="background:${s.color}; --i:${j}"></div>`).join("")} </div> </div> `;
return card;
}

// ── Update agent opinion ──────────────────────────────────────
function updateAgentOpinion(index, opinion) {
const opEl = $(`agent-opinion-${index}`);
const statusEl = $(`agent-status-${index}`);
if (!opEl) return;

// Hide status dots
if (statusEl) statusEl.style.display = “none”;

// Type out opinion
opEl.innerHTML = “”;
typeText(opEl, opinion, 12);
}

// ── Build debate message ──────────────────────────────────────
function buildDebateMsg(agent, text, index) {
const s = agent.style;
const div = document.createElement(“div”);
div.className = “debate-msg”;
div.style.animationDelay = `${index * 0.15}s`;
div.innerHTML = `<div class="debate-avatar" style="border-color:${s.color}33; color:${s.color}; text-shadow:0 0 10px ${s.shadow}"> ${s.icon} </div> <div class="debate-bubble" style="border-left:2px solid ${s.color}44"> <div class="debate-who" style="color:${s.color}">${agent.name} <span style="color:var(--muted2)">· ${agent.role}</span></div> <div class="debate-text">${text}</div> </div>`;
return div;
}

// ── Render synthesis report ───────────────────────────────────
function renderReport(rawText) {
// Parse sections and highlight keys
const formatted = rawText
.replace(/^(CONSENSUS|DISSENT|PREDICTION|RISK VECTORS|CONFIDENCE|VERDICT)$/gm,
‘<span class="report-key">▸ $1</span>’)
.replace(/^(→|•|-) /gm, ’<span style="color:var(--accent2)">→</span> ’);

els.synthesisContent.innerHTML = formatted;
}

// ── Progress helpers ──────────────────────────────────────────
function showProgress(phases, activeIdx) {
els.progressBlock.classList.remove(“hidden”);
els.progressPhases.innerHTML = phases.map((p, i) =>
`<div class="phase-tag" id="phase-${i}">${p}</div>`
).join(””);
}

function setPhaseActive(idx, done = false) {
document.querySelectorAll(”.phase-tag”).forEach((el, i) => {
el.className = “phase-tag”;
if (i < idx || (done && i === idx)) el.classList.add(“done”);
else if (i === idx && !done) el.classList.add(“active”);
});
}

function setProgressFill(pct) {
els.progressFill.style.width = pct + “%”;
}

function setProgressLabel(msg) {
els.progressLabel.textContent = msg;
}

// ── Status helper ─────────────────────────────────────────────
function setStatus(type, msg) {
els.statusDot.className = “status-dot “ + type;
els.statusText.textContent = msg;
}

// ── Error handler ─────────────────────────────────────────────
function showError(msg) {
setStatus(“error”, “ERROR”);
setProgressLabel(“✕ “ + msg);
state.running = false;
els.launchBtn.disabled = false;
}

// ── Reset ─────────────────────────────────────────────────────
function resetAll() {
state = { running: false, agents: [], opinions: [], phase: “idle” };

els.topicInput.value = “”;
els.charCount.textContent = “0”;
els.launchBtn.disabled = false;
els.resetBtn.classList.add(“hidden”);

els.heroBlock.classList.remove(“hidden”);
els.progressBlock.classList.add(“hidden”);
els.subjectPill.classList.add(“hidden”);
els.agentsSection.classList.add(“hidden”);
els.debateSection.classList.add(“hidden”);
els.synthesisSection.classList.add(“hidden”);

els.agentsGrid.innerHTML = “”;
els.debateFeed.innerHTML = “”;
els.synthesisContent.innerHTML = “”;
els.progressFill.style.width = “0%”;
els.liveBadge.classList.add(“hidden”);

setStatus(””, “STANDBY”);
window.scrollTo({ top: 0, behavior: “smooth” });
}

// ── Scroll helper ─────────────────────────────────────────────
function scrollTo(el) {
setTimeout(() => el.scrollIntoView({ behavior: “smooth”, block: “start” }), 100);
}

// ── Type text effect ──────────────────────────────────────────
function typeText(el, text, speed = 10) {
let i = 0;
const iv = setInterval(() => {
el.textContent = text.slice(0, i + 1);
i++;
if (i >= text.length) clearInterval(iv);
}, speed);
}

// ── Sleep ─────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Background Canvas (particle field) ───────────────────────
(function initCanvas() {
const canvas = document.getElementById(“bgCanvas”);
const ctx = canvas.getContext(“2d”);
let W, H, particles = [];

function resize() {
W = canvas.width = window.innerWidth;
H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener(“resize”, resize);

const COLORS = [”#00e5ff”, “#ff6b35”, “#39ff14”, “#b48eff”, “#ffd166”];

class Particle {
constructor() { this.reset(); }
reset() {
this.x = Math.random() * W;
this.y = Math.random() * H;
this.vx = (Math.random() - 0.5) * 0.3;
this.vy = (Math.random() - 0.5) * 0.3;
this.r = Math.random() * 1.5 + 0.3;
this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
this.alpha = Math.random() * 0.4 + 0.05;
this.life = 0;
this.maxLife = Math.random() * 300 + 200;
}
update() {
this.x += this.vx;
this.y += this.vy;
this.life++;
if (this.life > this.maxLife || this.x < 0 || this.x > W || this.y < 0 || this.y > H) {
this.reset();
}
}
draw() {
const fade = this.life < 30 ? this.life / 30 : this.life > this.maxLife - 30 ? (this.maxLife - this.life) / 30 : 1;
ctx.globalAlpha = this.alpha * fade;
ctx.fillStyle = this.color;
ctx.beginPath();
ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
ctx.fill();
}
}

// Init particles
for (let i = 0; i < 80; i++) particles.push(new Particle());

// Draw connections
function drawConnections() {
for (let i = 0; i < particles.length; i++) {
for (let j = i + 1; j < particles.length; j++) {
const dx = particles[i].x - particles[j].x;
const dy = particles[i].y - particles[j].y;
const dist = Math.sqrt(dx * dx + dy * dy);
if (dist < 120) {
ctx.globalAlpha = (1 - dist / 120) * 0.08;
ctx.strokeStyle = particles[i].color;
ctx.lineWidth = 0.5;
ctx.beginPath();
ctx.moveTo(particles[i].x, particles[i].y);
ctx.lineTo(particles[j].x, particles[j].y);
ctx.stroke();
}
}
}
}

function loop() {
ctx.clearRect(0, 0, W, H);
drawConnections();
particles.forEach(p => { p.update(); p.draw(); });
requestAnimationFrame(loop);
}
loop();
})();
