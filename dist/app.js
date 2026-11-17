(() => {
  'use strict';

  const seed = window.DEVPATH_SEED;
  const app = document.querySelector('#app');
  const STORAGE_KEY = 'devpath-tracker-v1';
  const phases = [...new Set(seed.roadmap.map((day) => day.Phase))];
  const baseDate = seed.roadmap[0].Date.slice(0, 10);
  const projects = [
    { id: 'registry', name: 'Production Model Registry API', range: [8, 49], color: '#5a90ff', stack: ['FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Terraform'], description: 'A production-minded model registry API built through the backend, Docker, AWS, Terraform, and CI/CD phases.' },
    { id: 'pipeline', name: 'Reproducible ML Pipeline', range: [50, 63], color: '#4de1c1', stack: ['Python', 'MLflow', 'DVC', 'scikit-learn', 'validation'], description: 'A reproducible training, validation, and model registration workflow grounded in the roadmap’s ML engineering work.' },
    { id: 'platform', name: 'End-to-End MLOps Platform', range: [64, 90], color: '#aa83ff', stack: ['Kubernetes', 'AWS', 'MLflow', 'Prometheus', 'Grafana', 'Evidently'], description: 'The capstone platform combining pipelines, monitoring, Kubernetes, CI/CD, and model operations.' },
    { id: 'go', name: 'Go Infrastructure Utility', range: [83, 87], color: '#ffc766', stack: ['Go', 'HTTP APIs', 'Concurrency', 'CLI'], description: 'A focused infrastructure CLI built during the Go-for-MLOps sprint.' },
  ];

  const nav = [
    ['dashboard', '⌂', 'Dashboard'], ['roadmap', '▤', 'My Roadmap'], ['daily', '◈', 'Daily Tasks'],
    ['calendar', '□', 'Calendar'], ['projects', '◇', 'Projects'], ['resources', '↗', 'Learning Resources'],
    ['interviews', '?', 'Interview Prep'], ['analytics', '⌁', 'Analytics'], ['settings', '⚙', 'Settings'],
  ];

  const defaultState = () => ({
    version: 1,
    theme: 'dark',
    view: 'dashboard',
    selectedDay: getCurrentCandidate(),
    startDate: baseDate,
    schedules: {},
    taskState: {},
    customTasks: {},
    dayNotes: {},
    dayStatus: {},
    resources: {},
    resourceNotes: {},
    interviews: {},
    projectMeta: {},
    studySeconds: 0,
    studyByDate: {},
    activity: [],
    calendarMonth: baseDate.slice(0, 7) + '-01',
  });

  let state;
  let runtime = { timerDay: null, seconds: 0, interval: null, modal: null, roadmapQuery: '', roadmapPhase: 'All', resourceQuery: '', resourceArea: 'All', interviewArea: 'All' };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      state = saved && saved.version === 1 ? { ...defaultState(), ...saved } : defaultState();
    } catch { state = defaultState(); }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function logActivity(type, detail = '') {
    state.activity.unshift({ time: new Date().toISOString(), type, detail });
    state.activity = state.activity.slice(0, 50);
  }
  function dayByNo(day) { return seed.roadmap.find((row) => Number(row.Day) === Number(day)); }
  function getCurrentCandidate() {
    const today = localIso(new Date());
    const exact = seed.roadmap.find((day) => day.Date.slice(0, 10) === today);
    return exact ? Number(exact.Day) : 1;
  }
  function localIso(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }
  function dateFromIso(iso) { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(iso, count) { const d = dateFromIso(iso); d.setDate(d.getDate() + count); return localIso(d); }
  function getScheduledDate(dayNo) {
    if (state.schedules[dayNo]) return state.schedules[dayNo];
    return state.startDate === baseDate ? dayByNo(dayNo).Date.slice(0, 10) : addDays(state.startDate, dayNo - 1);
  }
  function formatDate(iso, short = false) {
    return new Intl.DateTimeFormat(undefined, { month: short ? 'short' : 'long', day: 'numeric', year: short ? undefined : 'numeric' }).format(dateFromIso(iso));
  }
  function esc(value = '') { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function standardTasks(day) {
    return [
      { id: 'learning', kind: 'Learning', text: day.Learning },
      { id: 'practice', kind: 'Practice', text: day['Daily Task'] },
      { id: 'output', kind: 'Deliverable', text: day['Expected Output'] },
      { id: 'interview', kind: 'Interview', text: day['Interview Practice'] },
    ];
  }
  function allTasks(dayNo) {
    const day = dayByNo(dayNo);
    const custom = (state.customTasks[dayNo] || []).map((task) => ({ ...task, kind: 'Custom' }));
    return [...standardTasks(day), ...custom];
  }
  function isTaskDone(dayNo, taskId) { return Boolean(state.taskState[dayNo]?.[taskId]); }
  function dayProgress(dayNo) {
    const tasks = allTasks(dayNo);
    const done = tasks.filter((task) => isTaskDone(dayNo, task.id)).length;
    return { total: tasks.length, done, value: tasks.length ? done / tasks.length : 0 };
  }
  function dayStatus(dayNo) {
    const forced = state.dayStatus[dayNo];
    if (forced === 'Skipped') return { label: 'Skipped', className: 'skipped', progress: 0 };
    const p = dayProgress(dayNo);
    if (p.value === 1) return { label: 'Completed', className: 'completed', progress: p.value };
    if (p.done > 0) return { label: 'In Progress', className: 'partial', progress: p.value };
    if (forced === 'In Progress') return { label: 'In Progress', className: 'in-progress', progress: 0 };
    return { label: 'Not Started', className: 'not-started', progress: 0 };
  }
  function overall() {
    const taskCounts = seed.roadmap.reduce((total, day) => {
      const p = dayProgress(day.Day); total.done += p.done; total.total += p.total; return total;
    }, { done: 0, total: 0 });
    return { ...taskCounts, value: taskCounts.total ? taskCounts.done / taskCounts.total : 0, completedDays: seed.roadmap.filter((day) => dayStatus(day.Day).label === 'Completed').length };
  }
  function phaseProgress(phase) {
    const members = seed.roadmap.filter((day) => day.Phase === phase);
    const counts = members.reduce((total, day) => { const p = dayProgress(day.Day); total.done += p.done; total.total += p.total; return total; }, { done: 0, total: 0 });
    return { count: members.length, ...counts, value: counts.total ? counts.done / counts.total : 0 };
  }
  function activeDay() {
    const today = localIso(new Date());
    const pending = seed.roadmap.filter((day) => dayStatus(day.Day).label !== 'Completed' && dayStatus(day.Day).label !== 'Skipped');
    return pending.find((day) => getScheduledDate(day.Day) >= today) || pending[0] || seed.roadmap[seed.roadmap.length - 1];
  }
  function studyHours() { return state.studySeconds / 3600; }
  function streak() {
    const activeDates = new Set(Object.keys(state.studyByDate).filter((day) => state.studyByDate[day] > 0));
    let d = dateFromIso(localIso(new Date())); let count = 0;
    if (!activeDates.has(localIso(d))) d.setDate(d.getDate() - 1);
    while (activeDates.has(localIso(d))) { count += 1; d.setDate(d.getDate() - 1); }
    return count;
  }
  function statusBadge(status) { return `<span class="status ${status.className}">${esc(status.label)}</span>`; }
  function renderNav() {
    return `<aside class="sidebar"><button class="brand" data-action="view" data-view="dashboard" aria-label="Open dashboard"><span class="brand-mark">d/</span><span class="brand-text">DevPath<small>90-day MLOps</small></span></button><div class="nav-label">Workspace</div><nav class="nav-list">${nav.map(([id, icon, label]) => `<button class="nav-item ${state.view === id ? 'active' : ''}" data-action="view" data-view="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><div class="tiny-progress"><span class="progress-ring" style="--progress:${Math.round(overall().value * 100)};width:25px;height:25px"><b style="font-size:7px">${Math.round(overall().value * 100)}</b></span><span>${overall().completedDays} of 90 days complete</span></div></div></aside>`;
  }
  function topbar(title) {
    return `<header class="topbar"><span class="crumb">DEVPATH / ${esc(title.toUpperCase())}</span><div class="top-actions"><button class="soft-btn" data-action="open-current">◈ Continue learning</button><button class="icon-btn" data-action="toggle-theme" title="Toggle theme">${state.theme === 'dark' ? '☼' : '◐'}</button><button class="icon-btn" data-action="help" title="Keyboard shortcuts">?</button></div></header>`;
  }
  function pageHeader(title, subtitle, controls = '') { return `<div class="page-header"><div><h1>${esc(title)}</h1><p class="subtle">${subtitle}</p></div>${controls}</div>`; }
  function metric(label, value, foot, accent) { return `<div class="metric-card" style="--card-accent:${accent}"><div class="metric-label"><span>${label}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></div>`; }
  function dashboard() {
    const o = overall(); const current = activeDay(); const p = dayProgress(current.Day); const currentPhase = phaseProgress(current.Phase);
    const nextMilestone = seed.roadmap.find((day) => day.Day > current.Day && day['Expected Output']) || current;
    const latest = state.activity.slice(0, 4);
    return `${pageHeader('Your learning dashboard', `A working view of the 90-day curriculum. Last saved in this browser just now.`)}
      <section class="metric-grid">${metric('Current roadmap day', `Day ${current.Day}`, `${current.Focus} · ${formatDate(getScheduledDate(current.Day), true)}`, '#5a90ff')}${metric('Days completed', `${o.completedDays} / 90`, `${o.done} of ${o.total} individual tasks`, '#4bd28a')}${metric('Overall completion', `${Math.round(o.value * 100)}%`, 'Calculated from real task check-offs', '#4de1c1')}${metric('Learning streak', `${streak()} days`, state.studySeconds ? 'Based on recorded study time' : 'Start the timer to build a streak', '#ffc766')}${metric('Study time', `${studyHours().toFixed(studyHours() >= 10 ? 0 : 1)}h`, state.studySeconds ? 'Logged with the study timer' : 'No study time logged yet', '#aa83ff')}</section>
      <section class="grid-2"><article class="card today-card"><div class="card-body" style="padding-top:18px"><div class="today-meta"><span class="day-badge">DAY ${current.Day}</span><span class="card-kicker">${esc(current.Phase)}</span></div><h2>${esc(current.Learning)}</h2><p class="subtle">${esc(current['Daily Task'])}</p><div class="today-bottom"><div><span class="card-kicker">Today's checklist</span><div style="font-size:12px;margin-top:4px;color:#dce7ff">${p.done} of ${p.total} tasks complete</div></div><button class="primary-btn" data-action="open-day" data-day="${current.Day}">Open day ${current.Day} →</button></div></div></article><article class="card"><div class="card-head"><div><div class="card-kicker">Current phase</div><h2>${esc(current.Phase)}</h2></div><div class="progress-ring" style="--progress:${Math.round(currentPhase.value * 100)}"><b>${Math.round(currentPhase.value * 100)}%</b></div></div><div class="card-body"><p class="subtle" style="margin-bottom:13px">${currentPhase.done} of ${currentPhase.total} phase tasks finished. Keep momentum with the daily workspace.</p><div class="bar"><span style="width:${currentPhase.value * 100}%"></span></div></div></article></section>
      <section class="grid-2"><article class="card"><div class="card-head"><div><div class="card-kicker">Today’s learning tasks</div><h2>What to work on next</h2></div><button class="soft-btn" data-action="open-day" data-day="${current.Day}">View all</button></div><div class="card-body">${allTasks(current.Day).slice(0, 4).map((task) => taskLine(current.Day, task)).join('')}</div></article><article class="card"><div class="card-head"><div><div class="card-kicker">Upcoming milestone</div><h2>Day ${nextMilestone.Day}: ${esc(nextMilestone['Expected Output'])}</h2></div></div><div class="card-body"><p class="subtle">${formatDate(getScheduledDate(nextMilestone.Day), true)} · ${esc(nextMilestone.Phase)}</p><button class="soft-btn" style="margin-top:13px" data-action="open-day" data-day="${nextMilestone.Day}">Review milestone →</button></div></article></section>
      <section class="grid-even"><article class="card"><div class="card-head"><div><div class="card-kicker">90-day activity</div><h2>Curriculum completion</h2></div><button class="soft-btn" data-action="view" data-view="roadmap">Roadmap →</button></div><div class="activity-grid">${seed.roadmap.map((day) => { const s = dayStatus(day.Day); const cls = s.label === 'Completed' ? 'complete' : s.label === 'In Progress' && s.progress > 0 ? 'partial' : s.label === 'In Progress' ? 'progress' : ''; return `<button class="activity-cell ${cls} ${current.Day === day.Day ? 'current' : ''}" title="Day ${day.Day}: ${s.label}" data-action="open-day" data-day="${day.Day}"></button>`; }).join('')}</div><div class="activity-legend"><span>Less</span><i></i><i></i><i></i><i></i><span>More</span></div></article><article class="card"><div class="card-head"><div><div class="card-kicker">Recent activity</div><h2>Tracker updates</h2></div></div><div class="card-body">${latest.length ? latest.map((item) => `<div class="upcoming-item"><span class="upcoming-day">${item.type === 'task' ? '✓' : item.type === 'timer' ? '◷' : '•'}</span><div><button>${esc(item.detail)}</button><small>${formatRelative(item.time)}</small></div></div>`).join('') : `<div class="empty">Your task, timer, and note updates will appear here.</div>`}</div></article></section>`;
  }
  function taskLine(dayNo, task, allowDelete = false) { const done = isTaskDone(dayNo, task.id); return `<div class="task-line"><input class="check" type="checkbox" data-action="toggle-task" data-day="${dayNo}" data-task="${esc(task.id)}" ${done ? 'checked' : ''} aria-label="Mark task complete" /><div class="task-copy"><div class="task-label ${done ? 'done' : ''}">${esc(task.text)}</div><span class="task-kind">${esc(task.kind)}</span></div>${allowDelete && task.kind === 'Custom' ? `<button class="mini-btn" data-action="delete-custom" data-day="${dayNo}" data-task="${esc(task.id)}">Remove</button>` : ''}</div>`; }
  function roadmap() {
    const q = runtime.roadmapQuery.toLowerCase(); const phase = runtime.roadmapPhase;
    const visible = seed.roadmap.filter((day) => (phase === 'All' || day.Phase === phase) && [day.Day, day.Phase, day.Focus, day.Learning, day['Daily Task'], day['Expected Output']].join(' ').toLowerCase().includes(q));
    const controls = `<div class="controls"><input class="search" value="${esc(runtime.roadmapQuery)}" data-input="roadmap-query" placeholder="Search topics or tasks" /><select class="select" data-change="roadmap-phase"><option>All</option>${phases.map((item) => `<option ${phase === item ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></div>`;
    return `${pageHeader('My roadmap', 'The curriculum below comes from your workbook. Dates may be rescheduled without changing day order.', controls)}<div class="table-wrap"><table class="data-table"><thead><tr><th>Day</th><th>Scheduled</th><th>Phase</th><th>Focus</th><th>Learning & practical work</th><th>Output</th><th>Status</th></tr></thead><tbody>${visible.map((day) => { const p = dayProgress(day.Day); return `<tr class="click-row" data-action="open-day" data-day="${day.Day}"><td class="day-number">${day.Day}</td><td>${formatDate(getScheduledDate(day.Day), true)}</td><td>${esc(day.Phase)}</td><td>${esc(day.Focus)}</td><td class="table-focus"><b>${esc(day.Learning)}</b><br><span style="color:var(--muted)">${esc(day['Daily Task'])}</span></td><td>${esc(day['Expected Output'])}</td><td>${statusBadge(dayStatus(day.Day))}<div style="font:9px 'DM Mono',monospace;color:var(--faint);margin-top:5px">${p.done}/${p.total} tasks</div></td></tr>`; }).join('')}</tbody></table></div>${visible.length ? '' : '<div class="empty">No roadmap days match that search.</div>'}`;
  }
  function daily() {
    const dayNo = clamp(Number(state.selectedDay) || 1, 1, 90); const day = dayByNo(dayNo); const p = dayProgress(dayNo); const related = seed.resources.filter((resource) => resource.Area.toLowerCase().includes(day.Focus.toLowerCase()) || day.Learning.toLowerCase().includes(resource.Area.toLowerCase())).slice(0, 3);
    const controls = `<div class="workspace-nav"><button class="soft-btn" data-action="previous-day" ${dayNo <= 1 ? 'disabled' : ''}>← Previous</button><span class="day-badge">DAY ${dayNo} / 90</span><button class="soft-btn" data-action="next-day" ${dayNo >= 90 ? 'disabled' : ''}>Next →</button></div>`;
    return `${pageHeader(`Day ${dayNo}: ${day.Focus}`, `${day.Phase} · Scheduled for ${formatDate(getScheduledDate(dayNo))}`, controls)}<section class="workspace-layout"><article class="card"><div class="detail-section"><h3>Learning objective</h3><p>${esc(day.Learning)}</p></div><div class="detail-section"><h3>Practical coding task</h3><p>${esc(day['Daily Task'])}</p></div><div class="detail-section"><h3>Expected output</h3><p>${esc(day['Expected Output'])}</p></div><div class="detail-section"><h3>Course and documentation</h3>${related.length ? related.map((resource) => `<a class="resource-chip" href="${esc(resource.URL)}" target="_blank" rel="noreferrer"><span>↗</span><span><b>${esc(resource.Resource)}</b><br><small>${esc(resource['How to use it'])}</small></span></a>`).join('<div style="height:7px"></div>') : `<p>No one-to-one resource is listed for this day. Browse the source library to choose the right reference.</p>`}</div></article><article class="card"><div class="detail-section"><div class="card-title-row"><div><div class="card-kicker">Daily checklist</div><h2>${p.done} of ${p.total} tasks complete</h2></div><select class="select" data-change="day-status" data-day="${dayNo}"><option ${dayStatus(dayNo).label === 'Not Started' ? 'selected' : ''}>Not Started</option><option ${dayStatus(dayNo).label === 'In Progress' ? 'selected' : ''}>In Progress</option><option ${dayStatus(dayNo).label === 'Completed' ? 'selected' : ''}>Completed</option><option ${dayStatus(dayNo).label === 'Skipped' ? 'selected' : ''}>Skipped</option></select></div>${allTasks(dayNo).map((task) => taskLine(dayNo, task, true)).join('')}<div class="custom-task"><input class="field" id="custom-task-input" placeholder="Add a custom task" /><button class="soft-btn" data-action="add-custom" data-day="${dayNo}">Add</button></div></div><div class="detail-section"><h3>Study timer</h3><div class="timer"><div class="card-kicker">Logged today: ${formatDuration(state.studyByDate[localIso(new Date())] || 0)}</div><div class="timer-value" id="timer-value">${formatDuration(runtime.timerDay === dayNo ? runtime.seconds : 0)}</div><div class="timer-actions"><button class="primary-btn" data-action="timer-start" data-day="${dayNo}">${runtime.timerDay === dayNo && runtime.interval ? 'Running' : 'Start'}</button><button class="mini-btn" data-action="timer-stop">Stop & log</button><button class="mini-btn" data-action="timer-reset">Reset</button><button class="mini-btn" data-action="log-study" data-minutes="30">Log 30 min</button></div></div></div><div class="detail-section"><h3>Notes and proof</h3><textarea class="field notes" data-input="day-note" data-day="${dayNo}" placeholder="Add a GitHub link, a takeaway, a blocker, or proof of work…">${esc(state.dayNotes[dayNo] || '')}</textarea></div><div class="detail-section"><h3>Reschedule this learning day</h3><input class="field" type="date" data-change="scheduled-date" data-day="${dayNo}" value="${getScheduledDate(dayNo)}" /></div></article></section>`;
  }
  function calendar() {
    const month = dateFromIso(state.calendarMonth); const year = month.getFullYear(); const monthIndex = month.getMonth(); const first = new Date(year, monthIndex, 1); const last = new Date(year, monthIndex + 1, 0); const lead = first.getDay(); const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push('<div class="calendar-cell blank"></div>');
    for (let d = 1; d <= last.getDate(); d += 1) { const iso = localIso(new Date(year, monthIndex, d)); const day = seed.roadmap.find((row) => getScheduledDate(row.Day) === iso); const s = day ? dayStatus(day.Day) : null; cells.push(`<div class="calendar-cell"><div class="date-number">${d}</div>${day ? `<button class="calendar-event ${s.label === 'Completed' ? 'completed' : s.progress > 0 ? 'partial' : ''}" data-action="open-day" data-day="${day.Day}">D${day.Day} · ${esc(day.Focus)}<br><span>${esc(s.label)}</span></button>` : ''}</div>`); }
    const controls = `<div class="calendar-tools"><button class="soft-btn" data-action="calendar-previous">←</button><span class="day-badge">${new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first)}</span><button class="soft-btn" data-action="calendar-next">→</button></div>`;
    const missed = seed.roadmap.filter((day) => getScheduledDate(day.Day) < localIso(new Date()) && !['Completed', 'Skipped'].includes(dayStatus(day.Day).label)).length;
    return `${pageHeader('Calendar & scheduling', `${missed ? `${missed} past scheduled learning days are still open.` : 'No open days are currently overdue.'} Rescheduling never changes the curriculum’s day numbers.`, controls)}<article class="card"><div class="card-head"><div><div class="card-kicker">Monthly view</div><h2>Scheduled learning days</h2></div><button class="soft-btn" data-action="view" data-view="daily">Open current day</button></div><div class="card-body"><div class="calendar-grid"><div class="weekday">Sun</div><div class="weekday">Mon</div><div class="weekday">Tue</div><div class="weekday">Wed</div><div class="weekday">Thu</div><div class="weekday">Fri</div><div class="weekday">Sat</div>${cells.join('')}</div></div></article><section class="grid-even" style="margin-top:18px"><article class="card"><div class="card-head"><div><div class="card-kicker">Schedule controls</div><h2>Roadmap timing</h2></div></div><div class="card-body"><p class="subtle">Set a different start date in Settings to move the entire sequence. Use a daily workspace to override one specific day.</p><button class="soft-btn" style="margin-top:12px" data-action="view" data-view="settings">Open schedule settings →</button></div></article><article class="card"><div class="card-head"><div><div class="card-kicker">Weekly review</div><h2>Source review windows</h2></div></div><div class="card-body">${seed.weeklyReviews.slice(0, 4).map((week) => `<div class="upcoming-item"><span class="upcoming-day">W${week.Week}</span><div><button>${formatDate(week.Start.slice(0, 10), true)} – ${formatDate(week.End.slice(0, 10), true)}</button><small>Add your reflection in the notes section of the related learning days.</small></div></div>`).join('')}</div></article></section>`;
  }
  function projectsPage() {
    return `${pageHeader('Projects & portfolio', 'Progress is calculated from the related roadmap-day checklists. Add repository and deployment links as you build.')}<section class="project-grid">${projects.map((project, index) => { const related = seed.roadmap.filter((day) => day.Day >= project.range[0] && day.Day <= project.range[1]); const totals = related.reduce((sum, day) => { const p = dayProgress(day.Day); sum.done += p.done; sum.total += p.total; return sum; }, { done: 0, total: 0 }); const value = totals.total ? totals.done / totals.total : 0; const meta = state.projectMeta[project.id] || {}; return `<article class="card project-card" style="--project-color:${project.color}"><div class="project-head"><div><span class="project-count">PROJECT ${index + 1} · DAYS ${project.range[0]}–${project.range[1]}</span><h2 class="project-name">${esc(project.name)}</h2></div><div class="progress-ring" style="--progress:${Math.round(value * 100)}"><b>${Math.round(value * 100)}%</b></div></div><p>${esc(project.description)}</p><div class="tag-list">${project.stack.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div><div class="project-progress"><div class="bar"><span style="width:${value * 100}%;background:${project.color}"></span></div><span class="mono" style="font-size:10px;color:var(--muted)">${totals.done}/${totals.total}</span></div><div class="project-links"><input class="field" data-input="project-meta" data-project="${project.id}" data-key="repo" value="${esc(meta.repo || '')}" placeholder="GitHub repository URL" /><input class="field" data-input="project-meta" data-project="${project.id}" data-key="deploy" value="${esc(meta.deploy || '')}" placeholder="Deployment URL" /></div><textarea class="field notes" style="min-height:70px;margin-top:8px" data-input="project-meta" data-project="${project.id}" data-key="notes" placeholder="Architecture notes or next milestone…">${esc(meta.notes || '')}</textarea></article>`; }).join('')}</section>`;
  }
  function resourcesPage() {
    const areas = [...new Set(seed.resources.map((item) => item.Area))]; const q = runtime.resourceQuery.toLowerCase(); const visible = seed.resources.filter((item) => (runtime.resourceArea === 'All' || item.Area === runtime.resourceArea) && Object.values(item).join(' ').toLowerCase().includes(q));
    const controls = `<div class="controls"><input class="search" data-input="resource-query" value="${esc(runtime.resourceQuery)}" placeholder="Search resource library" /><select class="select" data-change="resource-area"><option>All</option>${areas.map((area) => `<option ${runtime.resourceArea === area ? 'selected' : ''}>${esc(area)}</option>`).join('')}</select></div>`;
    return `${pageHeader('Learning resources', 'Real source links and pricing from the workbook. Save the ones you are actively using.', controls)}<section class="resource-grid">${visible.map((resource, index) => { const saved = state.resources[index]; return `<article class="card resource-card"><div class="resource-area">${esc(resource.Area)} · ${esc(resource.Cost)}</div><h3>${esc(resource.Resource)}</h3><p>${esc(resource['How to use it'])}</p><div class="resource-bottom"><a class="resource-link" href="${esc(resource.URL)}" target="_blank" rel="noreferrer">Open source ↗</a><button class="mini-btn" data-action="toggle-resource" data-resource="${index}">${saved ? 'Saved ✓' : 'Save'}</button></div></article>`; }).join('')}</section>${visible.length ? '' : '<div class="empty">No resources match that search.</div>'}`;
  }
  function interviewsPage() {
    const areas = [...new Set(seed.interviews.map((item) => item.Area))]; const visible = seed.interviews.filter((item) => runtime.interviewArea === 'All' || item.Area === runtime.interviewArea); const practiced = Object.values(state.interviews).filter((item) => item?.status && item.status !== 'Not Practiced').length;
    const controls = `<div class="controls"><select class="select" data-change="interview-area"><option>All</option>${areas.map((area) => `<option ${runtime.interviewArea === area ? 'selected' : ''}>${esc(area)}</option>`).join('')}</select></div>`;
    return `${pageHeader('Interview preparation', `${practiced} of ${seed.interviews.length} topics have been started. Use your own answer notes and confidence state.`, controls)}<div class="table-wrap"><table class="data-table"><thead><tr><th>Area</th><th>Question / topic</th><th>Practice type</th><th>Revision status</th><th>Personal answer notes</th></tr></thead><tbody>${visible.map((item, index) => { const data = state.interviews[index] || {}; return `<tr><td>${esc(item.Area)}</td><td class="table-focus"><b>${esc(item['Question / Topic'])}</b><br><span style="color:var(--faint)">${esc(item.Category)}</span></td><td>${esc(item['Practice Type'])}</td><td><select class="select" data-change="interview-status" data-interview="${index}"><option ${(!data.status || data.status === 'Not Practiced') ? 'selected' : ''}>Not Practiced</option><option ${data.status === 'Needs Revision' ? 'selected' : ''}>Needs Revision</option><option ${data.status === 'Confident' ? 'selected' : ''}>Confident</option><option ${data.status === 'Mastered' ? 'selected' : ''}>Mastered</option></select></td><td><input class="field" data-input="interview-note" data-interview="${index}" value="${esc(data.note || '')}" placeholder="Your answer or revision note" /></td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function analyticsPage() {
    const o = overall(); const phaseRows = phases.map((phase) => ({ phase, ...phaseProgress(phase) })); const weekly = seed.weeklyReviews.map((week) => {
      const seconds = Object.entries(state.studyByDate).filter(([date]) => date >= week.Start.slice(0, 10) && date <= week.End.slice(0, 10)).reduce((sum, [, value]) => sum + value, 0); return { week, seconds };
    }); const max = Math.max(...weekly.map((item) => item.seconds), 1); const statusCounts = ['Not Practiced', 'Needs Revision', 'Confident', 'Mastered'].reduce((result, label) => { result[label] = Object.values(state.interviews).filter((item) => (item?.status || 'Not Practiced') === label).length; return result; }, {}); const interviewStarted = seed.interviews.length - statusCounts['Not Practiced']; const missed = seed.roadmap.filter((day) => getScheduledDate(day.Day) < localIso(new Date()) && !['Completed', 'Skipped'].includes(dayStatus(day.Day).label)).length;
    return `${pageHeader('Progress analytics', 'Every metric below is calculated from task check-offs, saved interview states, and timer sessions in this browser.')}<section class="metric-grid">${metric('Completed tasks', `${o.done} / ${o.total}`, `${o.completedDays} completed learning days`, '#4bd28a')}${metric('Study time', `${studyHours().toFixed(1)}h`, 'From the built-in daily timer', '#aa83ff')}${metric('Consistency', `${streak()} day streak`, 'Consecutive days with logged study time', '#ffc766')}${metric('Interview readiness', `${interviewStarted} / ${seed.interviews.length}`, 'Topics practiced at least once', '#5a90ff')}${metric('Missed study days', `${missed}`, 'Past scheduled days still open', '#f17886')}</section><section class="analytics-grid"><article class="card chart"><div class="chart-title">Weekly study time</div><p class="subtle" style="font-size:10px;margin:4px 0 0">Hours recorded in each source review window</p><div class="bar-chart">${weekly.map((item) => `<div class="chart-col"><i style="height:${Math.max((item.seconds / max) * 125, item.seconds ? 7 : 3)}px"></i><span>W${item.week.Week}</span></div>`).join('')}</div></article><article class="card chart"><div class="chart-title">Overall task completion</div><div class="donut-row"><div class="donut" style="--p:${Math.round(o.value * 100)}"><div>${Math.round(o.value * 100)}%<small>${o.done} tasks done</small></div></div></div></article></section><section class="grid-2"><article class="card"><div class="card-head"><div><div class="card-kicker">Phase completion</div><h2>Curriculum coverage</h2></div></div><div class="card-body"><div class="phase-list">${phaseRows.map((row) => `<div class="phase-row"><label>${esc(row.phase)}</label><div class="bar"><span style="width:${row.value * 100}%"></span></div><b>${Math.round(row.value * 100)}%</b></div>`).join('')}</div></div></article><article class="card"><div class="card-head"><div><div class="card-kicker">Interview readiness</div><h2>Revision distribution</h2></div></div><div class="card-body"><div class="insight-list">${Object.entries(statusCounts).map(([status, count]) => `<div class="insight"><b>${count}</b> ${esc(status)}${count === 1 ? ' topic' : ' topics'}</div>`).join('')}<div class="insight">Project progress updates automatically from the tasks completed in each project’s source day range.</div></div></div></article></section>`;
  }
  function settingsPage() {
    return `${pageHeader('Settings', 'Customize scheduling and manage a local backup of your private tracking data.')}<section class="settings-layout"><article class="card settings-card"><div class="card-kicker">Roadmap schedule</div><h2>Start date</h2><p class="subtle">Changing this shifts planned dates for the full sequence. Any day you rescheduled manually remains where you put it.</p><div class="settings-group"><label for="start-date">Day 1 starts on</label><input class="field" id="start-date" type="date" value="${state.startDate}" data-change="start-date" /><div class="settings-actions"><button class="primary-btn" data-action="save-start-date">Save schedule</button><button class="soft-btn" data-action="start-today">Start today</button><button class="soft-btn" data-action="restore-source-dates">Restore source dates</button></div></div><div class="settings-group"><div class="card-kicker">Appearance</div><p class="subtle">Your preference is saved locally.</p><div class="settings-actions"><button class="soft-btn" data-action="toggle-theme">Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme</button></div></div></article><article class="card settings-card"><div class="card-kicker">Data & shortcuts</div><h2>Keep your progress safe</h2><div class="settings-group"><p class="subtle">DevPath stores your task status, notes, time, dates, and personal links in this browser. Export a backup before changing devices or clearing browser data.</p><div class="settings-actions"><button class="primary-btn" data-action="export-json">Export progress JSON</button><button class="soft-btn" data-action="export-csv">Export day summary CSV</button><button class="danger-btn" data-action="reset-data">Reset local progress</button></div></div><div class="settings-group"><div class="key-list"><span class="key">D</span><span>Open your current learning day</span><span class="key">?</span><span>Show keyboard shortcuts</span><span class="key">Esc</span><span>Close the shortcuts panel</span></div></div></article></section>`;
  }
  function formatRelative(time) { const diff = Math.max(0, Date.now() - new Date(time).getTime()); const mins = Math.floor(diff / 60000); if (mins < 1) return 'Just now'; if (mins < 60) return `${mins} min ago`; const hrs = Math.floor(mins / 60); return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`; }
  function formatDuration(seconds) { const total = Math.round(seconds); const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60; return h ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  function renderModal() { if (!runtime.modal) return ''; return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" data-modal-content><div class="modal-head"><div><div class="card-kicker">DevPath shortcuts</div><h2>Navigate faster</h2></div><button class="icon-btn" data-action="close-modal">×</button></div><div class="modal-body"><p>Use these shortcuts when you are not typing in a field.</p><div class="key-list"><span class="key">D</span><span>Open the next learning day</span><span class="key">?</span><span>Open this help panel</span><span class="key">Esc</span><span>Close this panel</span></div></div><footer><button class="primary-btn" data-action="close-modal">Got it</button></footer></div></div>`; }
  function render() {
    document.documentElement.dataset.theme = state.theme;
    const pageMap = { dashboard: ['Dashboard', dashboard], roadmap: ['My Roadmap', roadmap], daily: ['Daily Tasks', daily], calendar: ['Calendar', calendar], projects: ['Projects', projectsPage], resources: ['Learning Resources', resourcesPage], interviews: ['Interview Preparation', interviewsPage], analytics: ['Analytics', analyticsPage], settings: ['Settings', settingsPage] };
    const [title, body] = pageMap[state.view] || pageMap.dashboard;
    app.innerHTML = `<div class="app-shell">${renderNav()}<main class="main">${topbar(title)}${body()}</main></div><div class="toast" id="toast"></div>${renderModal()}`;
  }
  function showToast(message) { const toast = document.querySelector('#toast'); if (!toast) return; toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timeout); showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2600); }
  function view(name) { state.view = name; saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function openDay(day) { state.selectedDay = Number(day); state.view = 'daily'; saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function setTask(day, id, done) {
    state.taskState[day] ||= {}; state.taskState[day][id] = done; if (done && state.dayStatus[day] === 'Skipped') delete state.dayStatus[day]; if (done) logActivity('task', `Completed a ${id === 'custom' ? 'custom' : id} task on Day ${day}`); saveState(); render();
  }
  function setDayStatus(day, label) {
    if (label === 'Completed') allTasks(day).forEach((task) => { state.taskState[day] ||= {}; state.taskState[day][task.id] = true; });
    if (label === 'Not Started') { state.taskState[day] = {}; delete state.dayStatus[day]; }
    else if (label !== 'Completed') state.dayStatus[day] = label;
    else delete state.dayStatus[day];
    logActivity('status', `Set Day ${day} to ${label}`); saveState(); render();
  }
  function startTimer(day) { if (runtime.interval) return showToast('The study timer is already running.'); runtime.timerDay = Number(day); runtime.interval = setInterval(() => { runtime.seconds += 1; const target = document.querySelector('#timer-value'); if (target) target.textContent = formatDuration(runtime.seconds); }, 1000); render(); }
  function stopTimer() { if (!runtime.interval) return showToast('Start the timer first.'); clearInterval(runtime.interval); runtime.interval = null; const seconds = runtime.seconds; runtime.seconds = 0; if (seconds) { const today = localIso(new Date()); state.studySeconds += seconds; state.studyByDate[today] = (state.studyByDate[today] || 0) + seconds; logActivity('timer', `Logged ${formatDuration(seconds)} of study time`); saveState(); showToast(`Saved ${formatDuration(seconds)} of study time.`); } render(); }
  function download(filename, type, content) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }
  function exportCsv() { const rows = [['Day', 'Scheduled date', 'Phase', 'Focus', 'Status', 'Tasks complete', 'Notes']]; seed.roadmap.forEach((day) => { const p = dayProgress(day.Day); rows.push([day.Day, getScheduledDate(day.Day), day.Phase, day.Focus, dayStatus(day.Day).label, `${p.done}/${p.total}`, state.dayNotes[day.Day] || '']); }); const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n'); download('devpath-day-summary.csv', 'text/csv', csv); showToast('CSV summary downloaded.'); }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]'); if (!target) return;
    if (target.dataset.modalContent !== undefined) return;
    const action = target.dataset.action;
    if (action === 'view') view(target.dataset.view);
    if (action === 'open-day') openDay(target.dataset.day);
    if (action === 'open-current') openDay(activeDay().Day);
    if (action === 'previous-day') openDay(Number(state.selectedDay) - 1);
    if (action === 'next-day') openDay(Number(state.selectedDay) + 1);
    if (action === 'toggle-theme') { state.theme = state.theme === 'dark' ? 'light' : 'dark'; saveState(); render(); }
    if (action === 'toggle-task') setTask(Number(target.dataset.day), target.dataset.task, target.checked);
    if (action === 'add-custom') { const input = document.querySelector('#custom-task-input'); const text = input?.value.trim(); const day = Number(target.dataset.day); if (!text) return showToast('Write a custom task first.'); const id = `custom-${Date.now()}`; (state.customTasks[day] ||= []).push({ id, text }); input.value = ''; logActivity('task', `Added a custom task to Day ${day}`); saveState(); render(); }
    if (action === 'delete-custom') { const day = Number(target.dataset.day); state.customTasks[day] = (state.customTasks[day] || []).filter((task) => task.id !== target.dataset.task); delete state.taskState[day]?.[target.dataset.task]; saveState(); render(); }
    if (action === 'timer-start') startTimer(target.dataset.day);
    if (action === 'timer-stop') stopTimer();
    if (action === 'timer-reset') { if (runtime.interval) clearInterval(runtime.interval); runtime.interval = null; runtime.seconds = 0; render(); showToast('Timer reset.'); }
    if (action === 'log-study') { const seconds = Number(target.dataset.minutes) * 60; const today = localIso(new Date()); state.studySeconds += seconds; state.studyByDate[today] = (state.studyByDate[today] || 0) + seconds; logActivity('timer', `Logged ${target.dataset.minutes} minutes of study time`); saveState(); render(); showToast('Study time logged.'); }
    if (action === 'calendar-previous' || action === 'calendar-next') { const current = dateFromIso(state.calendarMonth); current.setMonth(current.getMonth() + (action === 'calendar-next' ? 1 : -1)); state.calendarMonth = localIso(new Date(current.getFullYear(), current.getMonth(), 1)); saveState(); render(); }
    if (action === 'toggle-resource') { const id = target.dataset.resource; state.resources[id] = !state.resources[id]; saveState(); render(); showToast(state.resources[id] ? 'Resource saved.' : 'Resource removed from saved list.'); }
    if (action === 'save-start-date') { const input = document.querySelector('#start-date'); if (input?.value) { state.startDate = input.value; saveState(); render(); showToast('Roadmap schedule updated.'); } }
    if (action === 'start-today') { state.startDate = localIso(new Date()); state.schedules = {}; saveState(); render(); showToast('Day 1 is now scheduled for today.'); }
    if (action === 'restore-source-dates') { state.startDate = baseDate; state.schedules = {}; saveState(); render(); showToast('Workbook schedule restored.'); }
    if (action === 'export-json') { download('devpath-progress-backup.json', 'application/json', JSON.stringify(state, null, 2)); showToast('Progress backup downloaded.'); }
    if (action === 'export-csv') exportCsv();
    if (action === 'reset-data') { if (window.confirm('Reset every locally saved task, note, timer, and schedule change? This cannot be undone.')) { state = defaultState(); if (runtime.interval) clearInterval(runtime.interval); runtime = { timerDay: null, seconds: 0, interval: null, modal: null, roadmapQuery: '', roadmapPhase: 'All', resourceQuery: '', resourceArea: 'All', interviewArea: 'All' }; saveState(); render(); showToast('Local progress reset.'); } }
    if (action === 'help') { runtime.modal = 'help'; render(); }
    if (action === 'close-modal') { runtime.modal = null; render(); }
  });
  document.addEventListener('change', (event) => {
    const el = event.target;
    if (el.dataset.change === 'roadmap-phase') { runtime.roadmapPhase = el.value; render(); }
    if (el.dataset.change === 'resource-area') { runtime.resourceArea = el.value; render(); }
    if (el.dataset.change === 'interview-area') { runtime.interviewArea = el.value; render(); }
    if (el.dataset.change === 'day-status') setDayStatus(Number(el.dataset.day), el.value);
    if (el.dataset.change === 'scheduled-date') { state.schedules[Number(el.dataset.day)] = el.value; logActivity('status', `Rescheduled Day ${el.dataset.day} to ${formatDate(el.value, true)}`); saveState(); showToast('Learning day rescheduled.'); }
    if (el.dataset.change === 'start-date') { state.startDate = el.value; saveState(); }
    if (el.dataset.change === 'interview-status') { const index = el.dataset.interview; state.interviews[index] ||= {}; state.interviews[index].status = el.value; logActivity('status', `Updated interview topic to ${el.value}`); saveState(); render(); }
  });
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset.input === 'roadmap-query') { runtime.roadmapQuery = el.value; render(); }
    if (el.dataset.input === 'resource-query') { runtime.resourceQuery = el.value; render(); }
    if (el.dataset.input === 'day-note') { state.dayNotes[Number(el.dataset.day)] = el.value; saveState(); }
    if (el.dataset.input === 'project-meta') { state.projectMeta[el.dataset.project] ||= {}; state.projectMeta[el.dataset.project][el.dataset.key] = el.value; saveState(); }
    if (el.dataset.input === 'interview-note') { state.interviews[el.dataset.interview] ||= {}; state.interviews[el.dataset.interview].note = el.value; saveState(); }
  });
  document.addEventListener('keydown', (event) => { const tag = event.target.tagName; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return; if (event.key.toLowerCase() === 'd') { event.preventDefault(); openDay(activeDay().Day); } if (event.key === '?') { runtime.modal = 'help'; render(); } if (event.key === 'Escape' && runtime.modal) { runtime.modal = null; render(); } });
  loadState();
  render();
})();
