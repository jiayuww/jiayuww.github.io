/* ── Data Loading ── */
const DATA = {};
async function loadData() {
  const files = ['exploration', 'pipeline_log', 'handbook', 'candidates', 'test_examples'];
  const bust = Date.now();
  await Promise.all(files.map(async f => {
    const resp = await fetch(`data/${f}.json?v=${bust}`);
    DATA[f] = await resp.json();
  }));
}

/* ── Phase Navigation ── */
let currentPhase = 0;
function switchPhase(n) {
  currentPhase = n;
  document.querySelectorAll('.phase').forEach((el, i) => {
    el.classList.toggle('active', i === n);
  });
  document.querySelectorAll('.step').forEach((el, i) => {
    const p = parseInt(el.dataset.phase);
    el.classList.remove('active', 'completed');
    if (p === n) el.classList.add('active');
    else if (p < n) el.classList.add('completed');
  });
  document.querySelectorAll('.step-connector').forEach((el, i) => {
    el.classList.toggle('filled', i < n);
  });
  const target = document.getElementById(`phase-${n}`);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Color Utils ── */
const MODEL_COLORS = {
  'llama3.1-70b-instruct': '#3b82f6',
  'llama3.1-8b-instruct': '#60a5fa',
  'mixtral-8x22b-instruct': '#8b5cf6',
  'mistral-7b-instruct': '#a78bfa',
  'gemma2-27b-it': '#f59e0b',
  'qwen2.5-7b-instruct': '#10b981',
};
const MODEL_SHORT = {
  'llama3.1-70b-instruct': 'L70B',
  'llama3.1-8b-instruct': 'L8B',
  'mixtral-8x22b-instruct': 'Mix',
  'mistral-7b-instruct': 'Mis',
  'gemma2-27b-it': 'Gem',
  'qwen2.5-7b-instruct': 'Qw',
};

function scoreColor(v) {
  if (v >= 0.8) return '#22c55e';
  if (v >= 0.6) return '#86efac';
  if (v >= 0.4) return '#fbbf24';
  if (v >= 0.2) return '#fb923c';
  return '#ef4444';
}
function scoreBg(v) {
  if (v >= 0.8) return '#dcfce7';
  if (v >= 0.6) return '#ecfdf5';
  if (v >= 0.4) return '#fef9c3';
  if (v >= 0.2) return '#ffedd5';
  return '#fee2e2';
}

/* ══════════════════════════════════════
   Phase 0: Exploration
   ══════════════════════════════════════ */
function renderExploration() {
  const d = DATA.exploration;
  const statsEl = document.getElementById('exploration-stats');
  statsEl.innerHTML = [
    { v: d.num_queries, l: 'Queries' },
    { v: d.num_models, l: 'Models' },
    { v: d.total_traces, l: 'Total Traces' },
  ].map(s => `<div class="stat-card"><div class="stat-value">${s.v}</div><div class="stat-label">${s.l}</div></div>`).join('');

  const poolEl = document.getElementById('model-pool');
  poolEl.innerHTML = d.models.map(m => {
    const color = MODEL_COLORS[m.name] || '#666';
    return `<div class="pool-model-card" style="border-left: 4px solid ${color}">
      <div class="pool-model-name" style="color:${color}">${m.name}</div>
    </div>`;
  }).join('');

  const tableEl = document.getElementById('exploration-table');
  const modelOrder = Object.keys(d.model_stats);
  tableEl.innerHTML = d.queries.map(q => {
    const dots = modelOrder.map(m => {
      const r = q.model_results[m];
      return `<div class="model-dot ${r.success ? 'success' : 'fail'}" title="${m}: ${r.success ? 'Correct' : 'Wrong'}">${MODEL_SHORT[m] || m.slice(0, 3)}</div>`;
    }).join('');
    const responses = modelOrder.map(m => {
      const r = q.model_results[m];
      return `<div class="response-card">
        <h4><span class="em-badge ${r.success ? 'pass' : 'fail'}">${r.success ? 'PASS' : 'FAIL'}</span> ${m}</h4>
        <p>${escHtml(r.response)}</p>
      </div>`;
    }).join('');
    return `<div class="trace-row" onclick="this.classList.toggle('open')">
      <div class="trace-summary">
        <div class="trace-q">${escHtml(q.question)}</div>
        <div class="trace-gt" title="${escHtml(q.ground_truths.join(', '))}">${escHtml(q.ground_truths[0])}</div>
        <div class="model-dots">${dots}</div>
      </div>
      <div class="trace-expand"><div class="response-grid">${responses}</div></div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   Phase 1: Learning
   ══════════════════════════════════════ */
let learningAnimated = false;

function renderLearning() {
  const btn = document.getElementById('btn-learn');
  btn.addEventListener('click', () => {
    if (learningAnimated) return;
    learningAnimated = true;
    btn.disabled = true;
    animateLearningLog();
  });
}

function animateLearningLog() {
  const logEl = document.getElementById('learning-log');
  logEl.classList.add('visible');
  logEl.innerHTML = '';
  const events = DATA.pipeline_log;
  const status = document.getElementById('learn-status');

  let i = 0;
  const delay = 60;
  function next() {
    if (i >= events.length) {
      status.textContent = 'Learning complete!';
      showHandbook();
      return;
    }
    const ev = events[i];
    const line = formatLogEvent(ev);
    if (line) {
      const div = document.createElement('div');
      div.className = 'log-line';
      div.innerHTML = line;
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
      status.textContent = ev.msg || ev.type;
    }
    i++;
    setTimeout(next, delay);
  }
  next();
}

function formatLogEvent(ev) {
  const ts = ev.ts ? `<span class="log-ts">[${ev.ts}]</span> ` : '';
  switch (ev.type) {
    case 'phase': return `${ts}<span class="log-phase">${ev.msg}</span>`;
    case 'milestone': return `${ts}<span class="log-milestone">${ev.msg}</span>`;
    case 'discovery_result': return `${ts}<span class="log-discovery">${ev.msg}</span>`;
    case 'category': return `${ts}<span class="log-category">Category: ${ev.name}</span>`;
    case 'skill': return `<span class="log-skill">+ ${ev.id}: ${ev.name}</span>`;
    case 'profiling_progress': return `${ts}<span class="log-profiling">Profiling: ${ev.done}/${ev.total} bundles, ${ev.updates} updates</span>`;
    case 'profiling_done': return `${ts}<span class="log-done">${ev.msg}</span>`;
    case 'insights': return `${ts}<span class="log-profiling">${ev.msg}</span>`;
    case 'merge_candidates': return `${ts}<span class="log-milestone">${ev.msg}</span>`;
    case 'merge_applied': return `${ts}<span class="log-merge-apply">✓ Merged: ${ev.skill1} + ${ev.skill2} → ${ev.merged_into}</span>`;
    case 'merge_rejected': return `${ts}<span class="log-merge-reject">✗ Rejected merge: ${ev.skill1} + ${ev.skill2}</span>`;
    case 'refinement_done': return `${ts}<span class="log-done">${ev.msg}</span>`;
    case 'profile_summary': return `${ts}<span class="log-profiling">Summarizing [${ev.idx}/${ev.total}] ${ev.model}</span>`;
    case 'learning_done': return `${ts}<span class="log-done">${ev.msg}</span>`;
    default: return null;
  }
}

function showHandbook() {
  const display = document.getElementById('handbook-display');
  display.style.display = 'block';
  renderModeInsights();
  renderSkillTree();
  renderHeatmap();
}

function renderModeInsights() {
  const hb = DATA.handbook;
  const el = document.getElementById('mode-insights');
  const modeIcons = { search: '🔍', answer: '💬', code: '💻' };
  el.innerHTML = Object.entries(hb.modes).map(([id, mode]) => {
    const insights = mode.insights.map(ins => `
      <div class="insight-item">
        <span class="insight-type ${ins.insight_type}">${ins.insight_type}</span>
        <span>${escHtml(ins.content)}</span>
      </div>
    `).join('');
    return `<div class="mode-card" onclick="this.classList.toggle('open')">
      <div class="mode-card-header">
        <span>${modeIcons[id] || ''} ${id} <span class="hint">(${mode.insights.length} insights)</span></span>
        <span class="chevron">▶</span>
      </div>
      <div class="mode-card-body">${insights}</div>
    </div>`;
  }).join('');
}

function renderSkillTree() {
  const hb = DATA.handbook;
  document.getElementById('skill-count').textContent = Object.keys(hb.skills).length;
  const el = document.getElementById('skill-tree');
  el.innerHTML = Object.entries(hb.categories).map(([cat, info]) => {
    const skills = info.skills.map(sid => {
      const s = hb.skills[sid];
      return `<div class="skill-item" data-skill="${sid}" onclick="toggleSkillDetail(this, '${sid}')">
        <div class="skill-name">${escHtml(s.name)}</div>
        <div class="skill-desc">${escHtml(s.description.slice(0, 100))}${s.description.length > 100 ? '...' : ''}</div>
      </div>`;
    }).join('');
    const catLabel = cat.replace(/_/g, ' ');
    return `<div class="skill-category" onclick="event.stopPropagation();this.classList.toggle('open')">
      <div class="cat-header">
        <span class="chevron">▶</span>
        <span>${catLabel}</span>
        <span class="cat-count">${info.skills.length} skills</span>
      </div>
      <div class="cat-skills">${skills}</div>
    </div>`;
  }).join('');
}

function toggleSkillDetail(el, sid) {
  event.stopPropagation();
  const existing = el.querySelector('.skill-detail');
  if (existing) { existing.remove(); el.classList.remove('selected'); return; }
  document.querySelectorAll('.skill-item.selected').forEach(e => { e.classList.remove('selected'); const d = e.querySelector('.skill-detail'); if (d) d.remove(); });
  el.classList.add('selected');
  const s = DATA.handbook.skills[sid];
  const detail = document.createElement('div');
  detail.className = 'skill-detail';
  detail.innerHTML = `
    <dl>
      <dt>Description</dt><dd>${escHtml(s.description)}</dd>
      <dt>Indicators</dt><dd>${s.indicators.map(i => `<span class="indicator-tag">${escHtml(i)}</span>`).join('')}</dd>
      <dt>Examples</dt><dd>${s.examples.map(e => `<span class="indicator-tag">${escHtml(e)}</span>`).join('')}</dd>
      <dt>Mode</dt><dd>${s.mode}</dd>
    </dl>`;
  el.appendChild(detail);
}

/* ── Heatmap (per-category dropdown) ── */
function renderHeatmap() {
  const hb = DATA.handbook;
  const categories = Object.keys(hb.categories);
  const container = document.getElementById('heatmap-container');

  const selectHtml = `<div class="heatmap-controls">
    <label for="heatmap-cat-select">Category:</label>
    <select id="heatmap-cat-select" class="heatmap-select">
      ${categories.map((cat, i) => `<option value="${cat}" ${i === 0 ? 'selected' : ''}>${cat.replace(/_/g, ' ')}</option>`).join('')}
    </select>
  </div>
  <div id="heatmap-table-area"></div>`;
  container.innerHTML = selectHtml;

  const select = document.getElementById('heatmap-cat-select');
  select.addEventListener('change', () => renderHeatmapForCategory(select.value));
  renderHeatmapForCategory(categories[0]);
}

function renderHeatmapForCategory(catKey) {
  const hb = DATA.handbook;
  const agents = Object.keys(hb.agent_profiles);
  const skillIds = hb.categories[catKey]?.skills || [];
  const el = document.getElementById('heatmap-table-area');

  let thead = '<tr><th class="hm-model-header">Model</th><th class="hm-overall-header">Overall</th>';
  skillIds.forEach(sid => {
    const sname = hb.skills[sid].name;
    thead += `<th class="hm-skill-header" title="${escHtml(sname)}">${escHtml(sname)}</th>`;
  });
  thead += '</tr>';

  let tbody = '';
  agents.forEach(agentId => {
    const profile = hb.agent_profiles[agentId];
    const overall = profile.overall_accuracy;
    const overallColor = scoreColor(overall / 100);
    tbody += `<tr>
      <td class="hm-model-header" style="color:${MODEL_COLORS[agentId] || '#333'}">${agentId}</td>
      <td class="hm-overall-cell"><span class="heatmap-overall" style="background:${scoreBg(overall/100)};color:${overallColor}">${overall}%</span></td>`;
    skillIds.forEach(sid => {
      const sc = profile.skill_scores[sid];
      const v = sc !== undefined ? sc : -1;
      const bg = v < 0 ? '#f3f4f6' : scoreBg(v);
      const fg = v < 0 ? '#ccc' : scoreColor(v);
      const label = v < 0 ? '—' : (v * 100).toFixed(0) + '%';
      tbody += `<td class="hm-cell" style="background:${bg};color:${fg}" title="${hb.skills[sid]?.name}: ${label}" onclick="showAgentDetail('${agentId}')">${label}</td>`;
    });
    tbody += '</tr>';
  });

  el.innerHTML = `<table class="hm-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function showAgentDetail(agentId) {
  const profile = DATA.handbook.agent_profiles[agentId];
  const el = document.getElementById('agent-detail');
  el.style.display = 'block';
  const cost = profile.cost_stats;
  el.innerHTML = `
    <h4 style="color:${MODEL_COLORS[agentId] || '#333'}">${agentId}</h4>
    <div class="agent-meta">
      <span>Overall: <strong>${profile.overall_accuracy}%</strong> (${profile.total_successes}/${profile.total_attempts})</span>
      <span>Avg Cost: <strong>$${cost.avg_cost_usd?.toFixed(6) || '—'}</strong></span>
      <span>Avg Tokens: <strong>${Math.round(cost.avg_prompt_tokens || 0)} in / ${Math.round(cost.avg_completion_tokens || 0)} out</strong></span>
    </div>
    <div class="agent-lists">
      <div>
        <h5>Strengths</h5>
        <ul>${profile.strengths.slice(0, 6).map(s => `<li><span class="strength-icon"></span>${escHtml(s)}</li>`).join('')}</ul>
      </div>
      <div>
        <h5>Weaknesses</h5>
        <ul>${profile.weaknesses.slice(0, 6).map(w => `<li><span class="weakness-icon"></span>${escHtml(w)}</li>`).join('')}</ul>
      </div>
    </div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ══════════════════════════════════════
   Phase 2: Selection
   ══════════════════════════════════════ */
function renderSelection() {
  const btn = document.getElementById('btn-select');
  btn.addEventListener('click', () => {
    btn.disabled = true;
    document.getElementById('selection-content').style.display = 'block';
    animateSelection();
  });
}

function animateSelection() {
  const cands = DATA.candidates.candidates;
  const el = document.getElementById('candidate-cards');
  const statusEl = document.getElementById('select-status');

  el.innerHTML = cands.map(c => `
    <div class="cand-card hidden" data-id="${c.id}">
      <h4>${c.label}</h4>
      <div class="cand-stats">
        <div class="cand-stat"><span class="label">Skills</span><span class="val">${c.num_skills}</span></div>
        <div class="cand-stat"><span class="label">Accuracy</span><span class="val">${c.accuracy}%</span></div>
        <div class="cand-stat"><span class="label">Total Cost</span><span class="val">$${c.total_cost.toFixed(4)}</span></div>
        <div class="cand-stat"><span class="label">Latency</span><span class="val">${c.latency.toFixed(1)}s</span></div>
        <div class="cand-stat"><span class="label">Eval Samples</span><span class="val">${c.num_samples}</span></div>
      </div>
    </div>
  `).join('');

  const cards = el.querySelectorAll('.cand-card');
  let idx = 0;

  function revealNext() {
    if (idx < cards.length) {
      const c = cands[idx];
      statusEl.textContent = `Evaluating ${c.label}...`;
      cards[idx].classList.remove('hidden');
      cards[idx].classList.add('reveal');
      idx++;
      setTimeout(revealNext, 600);
    } else {
      statusEl.textContent = 'Comparing candidates...';
      setTimeout(() => {
        renderPareto();
        setTimeout(highlightSelected, 800);
      }, 500);
    }
  }

  function highlightSelected() {
    const selected = cands.find(c => c.is_selected);
    if (selected) {
      const card = el.querySelector(`[data-id="${selected.id}"]`);
      if (card) {
        card.classList.add('selected');
        const badge = document.createElement('div');
        badge.className = 'selected-badge';
        badge.textContent = 'SELECTED';
        card.prepend(badge);
      }
    }
    statusEl.innerHTML = `<strong>${selected ? selected.label : 'Best candidate'}</strong> selected — best accuracy at comparable cost.`;
  }

  revealNext();
}

function renderPareto() {
  const cands = DATA.candidates.candidates;
  const el = document.getElementById('pareto-chart');
  const W = el.clientWidth || 600;
  const H = 320;
  const pad = { top: 30, right: 50, bottom: 55, left: 65 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const costs = cands.map(c => c.total_cost);
  const accs = cands.map(c => c.accuracy);
  const lats = cands.map(c => c.latency);

  const costRange = Math.max(...costs) - Math.min(...costs);
  const costPad = costRange < 0.0001 ? 0.001 : costRange * 0.35;
  const minCost = Math.max(0, Math.min(...costs) - costPad);
  const maxCost = Math.max(...costs) + costPad;
  const accRange = Math.max(...accs) - Math.min(...accs);
  const accPad = accRange < 1 ? 5 : accRange * 0.35;
  const minAcc = Math.min(...accs) - accPad;
  const maxAcc = Math.max(...accs) + accPad;
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const latSpan = maxLat - minLat || 1;

  function xScale(v) { return pad.left + ((v - minCost) / (maxCost - minCost)) * iw; }
  function yScale(v) { return pad.top + ih - ((v - minAcc) / (maxAcc - minAcc)) * ih; }
  function rScale(v) { return 14 + ((v - minLat) / latSpan) * 18; }

  let svg = `<svg class="pareto-svg" viewBox="0 0 ${W} ${H}">`;
  svg += `<defs>`;
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
  cands.forEach((c, i) => {
    svg += `<radialGradient id="grad${i}" cx="35%" cy="35%"><stop offset="0%" stop-color="${colors[i]}" stop-opacity="0.9"/><stop offset="100%" stop-color="${colors[i]}" stop-opacity="0.5"/></radialGradient>`;
  });
  svg += `</defs>`;

  svg += `<line x1="${pad.left}" y1="${pad.top + ih}" x2="${pad.left + iw}" y2="${pad.top + ih}" stroke="#e2e4ea" stroke-width="1"/>`;
  svg += `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + ih}" stroke="#e2e4ea" stroke-width="1"/>`;
  svg += `<text x="${pad.left + iw / 2}" y="${H - 5}" text-anchor="middle" font-size="12" fill="#888" font-family="DM Sans">Total Cost (USD)</text>`;
  svg += `<text x="14" y="${pad.top + ih / 2}" text-anchor="middle" font-size="12" fill="#888" font-family="DM Sans" transform="rotate(-90, 14, ${pad.top + ih / 2})">Accuracy (%)</text>`;

  for (let a = Math.ceil(minAcc / 5) * 5; a <= maxAcc; a += 5) {
    const y = yScale(a);
    if (y >= pad.top && y <= pad.top + ih) {
      svg += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + iw}" y2="${y}" stroke="#f0f1f5" stroke-width="1"/>`;
      svg += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#999" font-family="JetBrains Mono">${a}%</text>`;
    }
  }

  const numXTicks = 4;
  for (let t = 0; t <= numXTicks; t++) {
    const v = minCost + (t / numXTicks) * (maxCost - minCost);
    const x = xScale(v);
    svg += `<text x="${x}" y="${pad.top + ih + 18}" text-anchor="middle" font-size="10" fill="#999" font-family="JetBrains Mono">$${v.toFixed(4)}</text>`;
  }

  const pareto = cands.filter(c => c.is_selected);
  if (pareto.length > 0) {
    const px = xScale(pareto[0].total_cost);
    const py = yScale(pareto[0].accuracy);
    svg += `<circle cx="${px}" cy="${py}" r="40" fill="rgba(48,43,99,0.06)" stroke="none"/>`;
  }

  cands.forEach((c, i) => {
    const cx = xScale(c.total_cost);
    const cy = yScale(c.accuracy);
    const r = rScale(c.latency);
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#grad${i})" stroke="#fff" stroke-width="2" opacity="0.85"/>`;
    svg += `<text x="${cx}" y="${cy - r - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="${colors[i]}" font-family="DM Sans">${c.label}</text>`;
    svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="9" font-weight="600" fill="#fff" font-family="JetBrains Mono">${c.latency.toFixed(1)}s</text>`;
    svg += `<text x="${cx}" y="${cy + r + 14}" text-anchor="middle" font-size="10" fill="#888" font-family="JetBrains Mono">${c.accuracy}% · $${c.total_cost.toFixed(4)}</text>`;
  });

  const legendY = pad.top + 4;
  const legendX = pad.left + iw - 120;
  svg += `<text x="${legendX}" y="${legendY}" font-size="10" fill="#888" font-family="DM Sans">Bubble size = Latency</text>`;
  svg += `<circle cx="${legendX - 12}" cy="${legendY - 3}" r="5" fill="#ccc" opacity="0.5"/>`;

  svg += '</svg>';
  el.innerHTML = svg;
}

/* ══════════════════════════════════════
   Phase 3: Testing
   ══════════════════════════════════════ */
function renderTesting() {
  const d = DATA.test_examples;

  const el = document.getElementById('test-examples');
  el.innerHTML = d.examples.map(ex => {
    const turns = ex.turns.map(t => {
      let content = '';
      if (t.skill_analysis && t.skill_analysis.required_skills) {
        const topSkills = t.skill_analysis.required_skills.filter(s => s.percentage > 0);
        content += `<div class="skill-analysis-box">
          <div style="color:#8ec5fc;margin-bottom:4px">Skill Analysis:</div>
          ${topSkills.map(s => `<span class="skill-tag">${s.skill_id} (${s.percentage}%)</span>`).join('')}
          ${t.skill_analysis.reasoning ? `<div style="margin-top:6px;color:#94a3b8">${escHtml(t.skill_analysis.reasoning)}</div>` : ''}
        </div>`;
      }
      if (t.routed_model) {
        content += `<div class="turn-response"><strong>Response from ${t.routed_model}:</strong><br>${escHtml(t.routed_response || '')}</div>`;
      } else if (t.action === 'answer') {
        const ans = t.extracted_answer || ex.answer || '';
        content += `<div class="extracted-answer"><strong>Extracted Answer:</strong> ${escHtml(ans)}</div>`;
      }
      return `<div class="turn-card">
        <div class="turn-header">
          <div class="turn-num">${t.turn_idx}</div>
          <div class="turn-action">${t.action}</div>
          ${t.routed_model ? `<div class="turn-model">→ ${t.routed_model}</div>` : ''}
        </div>
        ${content}
      </div>`;
    }).join('');

    const costStr = ex.costs?.total ? '$' + ex.costs.total.toFixed(6) : '—';
    return `<div class="test-card" onclick="this.classList.toggle('open')">
      <div class="test-card-header">
        <div class="test-q">${escHtml(ex.question)}</div>
        <div class="test-badge ${ex.success ? 'correct' : 'incorrect'}">${ex.success ? 'CORRECT' : 'WRONG'}</div>
      </div>
      <div class="test-card-body">
        <div class="test-meta">
          <span>Ground Truth: <strong>${escHtml(ex.ground_truths.join(', '))}</strong></span>
          <span>Answer: <strong>${escHtml(ex.answer)}</strong></span>
          <span>Turns: <strong>${ex.num_turns}</strong></span>
          <span>Cost: <strong>${costStr}</strong></span>
          <span>Models: <strong>${ex.models_called.join(', ')}</strong></span>
        </div>
        ${turns}
      </div>
    </div>`;
  }).join('');
}

/* ── Util ── */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Init ── */
async function init() {
  try {
    await loadData();
  } catch (e) {
    document.querySelector('main').innerHTML = `<div class="section-block"><h3>Error Loading Data</h3><p>Could not load demo data. Make sure you're serving from the demo/ directory.</p><pre>${e.message}</pre></div>`;
    return;
  }
  renderExploration();
  renderLearning();
  renderSelection();
  renderTesting();

  document.querySelectorAll('.step').forEach(btn => {
    btn.addEventListener('click', () => switchPhase(parseInt(btn.dataset.phase)));
  });
}
init();
