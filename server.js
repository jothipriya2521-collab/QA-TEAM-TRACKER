const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'entries.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const JIRA_HOST = process.env.JIRA_HOST || 'tvsmotorcompany.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';
const JIRA_AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

function getIST() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist;
}
function getISTDate() { return getIST().toISOString().split('T')[0]; }
function getISTTime() { return getIST().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }

function jiraRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const options = { hostname: JIRA_HOST, path: apiPath, method, headers: { 'Authorization': `Basic ${JIRA_AUTH}`, 'Accept': 'application/json', 'Content-Type': 'application/json' } };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }); } catch { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_FILE)) {
  const sampleEntries = [
    { id: 1721100000001, date: '2026-07-16', time: '10:30 AM', member: 'Jothipriya', project: 'Norton Phase 2', hours: 4, task: 'Reviewed 853 test cases aligned against user stories in JIRA', jira: 'CB01-8900', status: 'Completed', startDate: '2026-07-16', endDate: '2026-07-16', notes: '', reviewNotes: [] },
    { id: 1721100000002, date: '2026-07-16', time: '02:00 PM', member: 'Jothipriya', project: 'RFC Migration', hours: 2, task: 'Added new test cases in JIRA for RFC', jira: '', status: 'Completed', startDate: '2026-07-16', endDate: '2026-07-16', notes: '', reviewNotes: [] },
    { id: 1721100000003, date: '2026-07-16', time: '04:00 PM', member: 'Jothipriya', project: 'EMS Automation', hours: 2, task: 'Created TaskPulse web application for QA daily tracking', jira: '', status: 'In Progress', startDate: '2026-07-14', endDate: '2026-07-18', notes: '', reviewNotes: [{ by: 'Nivedhitha', text: 'Good initiative! Add export to PDF feature too.', time: '2026-07-16 05:00 PM' }] },
    { id: 1721100000004, date: '2026-07-16', time: '11:00 AM', member: 'Vimala', project: 'Digi App', hours: 5, task: 'Working on Digi mobile app automation - Token Creation Scenario', jira: '', status: 'In Progress', startDate: '2026-07-15', endDate: '2026-07-18', notes: '', reviewNotes: [] },
    { id: 1721100000005, date: '2026-07-16', time: '04:30 PM', member: 'Vimala', project: 'Norton Phase 2', hours: 3, task: 'Norton Phase 2 user stories analysis', jira: '', status: 'In Progress', startDate: '2026-07-16', endDate: '2026-07-17', notes: '', reviewNotes: [] },
    { id: 1721100000006, date: '2026-07-16', time: '10:00 AM', member: 'Sureshrajendran', project: 'Norton Phase 2', hours: 6, task: 'Created 120 test cases for CRP and shared with Navaneethan for review', jira: 'CB01-8850', status: 'Completed', startDate: '2026-07-16', endDate: '2026-07-16', notes: '', reviewNotes: [] },
    { id: 1721100000007, date: '2026-07-16', time: '05:00 PM', member: 'Sureshrajendran', project: 'RFC Migration', hours: 2, task: 'Created Automation Tool for RFC vs API response comparison', jira: '', status: 'Completed', startDate: '2026-07-14', endDate: '2026-07-16', notes: '', reviewNotes: [{ by: 'Sureshkannan', text: 'Share the tool documentation with the team.', time: '2026-07-16 05:30 PM' }] },
    { id: 1721100000008, date: '2026-07-16', time: '10:00 AM', member: 'Talent', project: 'Learning', hours: 6, task: 'Continued learning Selenium with Java - handling checkboxes and alerts', jira: '', status: 'In Progress', startDate: '2026-07-14', endDate: '2026-07-20', notes: '', reviewNotes: [] },
    { id: 1721100000009, date: '2026-07-16', time: '04:00 PM', member: 'Talent', project: 'Learning', hours: 2, task: 'Executed sample Test Cases', jira: '', status: 'Completed', startDate: '2026-07-16', endDate: '2026-07-16', notes: '', reviewNotes: [] }
  ];
  fs.writeFileSync(DATA_FILE, JSON.stringify(sampleEntries, null, 2));
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    { id: 1, name: 'Jothipriya', role: 'lead', password: 'jothi123', projects: ['Norton Phase 2', 'IOM', 'RFC Migration', 'EMS Automation', 'DMS Automation', 'Training', 'Learning'] },
    { id: 2, name: 'Vimala', role: 'member', password: 'vimala123', projects: ['Digi App', 'Norton Phase 2', 'RFC Migration'] },
    { id: 3, name: 'Sureshrajendran', role: 'member', password: 'suresh123', projects: ['Norton Phase 2', 'DMS Automation', 'RFC Migration'] },
    { id: 4, name: 'Talent', role: 'trainee', password: 'talent123', projects: ['Learning', 'Training', 'Norton Phase 2', 'RFC Migration'] },
    { id: 5, name: 'Thillai', role: 'manager', password: 'thillai123', projects: [] },
    { id: 6, name: 'Sureshkannan', role: 'manager', password: 'sureshk123', projects: [] },
    { id: 7, name: 'Nivedhitha', role: 'manager', password: 'nivedhitha123', projects: [] }
  ], null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
  if (user) res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, projects: user.projects } });
  else res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/change-password', (req, res) => {
  const { name, oldPassword, newPassword } = req.body;
  if (!name || !oldPassword || !newPassword) return res.status(400).json({ success: false, message: 'All fields required' });
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === oldPassword);
  if (!user) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  user.password = newPassword;
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true, message: 'Password changed successfully' });
});

app.get('/api/entries', (req, res) => {
  const { date, fromDate, toDate, member, project, status } = req.query;
  let entries = JSON.parse(fs.readFileSync(DATA_FILE));
  if (date) entries = entries.filter(e => e.date === date);
  if (fromDate) entries = entries.filter(e => e.date >= fromDate);
  if (toDate) entries = entries.filter(e => e.date <= toDate);
  if (member) entries = entries.filter(e => e.member === member);
  if (project) entries = entries.filter(e => e.project === project);
  if (status) entries = entries.filter(e => e.status === status);
  res.json(entries);
});

app.get('/api/pending-tasks', (req, res) => {
  const entries = JSON.parse(fs.readFileSync(DATA_FILE));
  const pendingTasks = entries.filter(e => e.status === 'In Progress' || e.status === 'Blocked');
  const grouped = {};
  pendingTasks.forEach(e => { if (!grouped[e.member]) grouped[e.member] = []; grouped[e.member].push(e); });
  res.json({ pendingTasks, grouped, total: pendingTasks.length });
});

app.post('/api/entries', (req, res) => {
  const entry = { id: Date.now(), date: getISTDate(), time: getISTTime(), reviewNotes: [], ...req.body };
  const entries = JSON.parse(fs.readFileSync(DATA_FILE));
  entries.unshift(entry);
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
  res.json({ success: true, entry });
});

// API: Add review note (managers only)
app.post('/api/entries/:id/review', (req, res) => {
  const { by, text, role } = req.body;
  if (!by || !text) return res.status(400).json({ success: false, message: 'Name and note text required' });
  if (role !== 'manager' && role !== 'lead') return res.status(403).json({ success: false, message: 'Only managers and lead can add review notes' });
  const entries = JSON.parse(fs.readFileSync(DATA_FILE));
  const entry = entries.find(e => e.id === parseInt(req.params.id));
  if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
  if (!entry.reviewNotes) entry.reviewNotes = [];
  entry.reviewNotes.push({ by, text, time: `${getISTDate()} ${getISTTime()}` });
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
  res.json({ success: true, message: 'Review note added', entry });
});

app.delete('/api/entries/:id', (req, res) => {
  let entries = JSON.parse(fs.readFileSync(DATA_FILE));
  entries = entries.filter(e => e.id !== parseInt(req.params.id));
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const today = getISTDate();
  const entries = JSON.parse(fs.readFileSync(DATA_FILE));
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const teamMembers = users.filter(u => u.role !== 'manager');
  const todayEntries = entries.filter(e => e.date === today);
  const membersUpdated = [...new Set(todayEntries.map(e => e.member))];
  const pendingTasks = entries.filter(e => e.status === 'In Progress' || e.status === 'Blocked');
  const memberStats = teamMembers.map(u => {
    const me = todayEntries.filter(e => e.member === u.name);
    const myPending = pendingTasks.filter(e => e.member === u.name);
    return { name: u.name, role: u.role, submitted: me.length > 0, hours: me.reduce((s, e) => s + (e.hours || 0), 0), projects: [...new Set(me.map(e => e.project))], entries: me, pendingCount: myPending.length };
  });
  res.json({ today, totalEntries: todayEntries.length, totalHours: todayEntries.reduce((s, e) => s + (e.hours || 0), 0), totalMembers: teamMembers.length, pending: teamMembers.length - teamMembers.filter(u => membersUpdated.includes(u.name)).length, pendingMembers: teamMembers.filter(u => !membersUpdated.includes(u.name)).map(u => u.name), memberStats, totalPendingTasks: pendingTasks.length });
});

app.get('/api/weekly', (req, res) => {
  const entries = JSON.parse(fs.readFileSync(DATA_FILE));
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  const now = new Date(); const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEntries = entries.filter(e => e.date >= weekStart.toISOString().split('T')[0]);
  const report = users.map(u => {
    const me = weekEntries.filter(e => e.member === u.name); const byProject = {};
    me.forEach(e => { if (!byProject[e.project]) byProject[e.project] = { hours: 0, tasks: [] }; byProject[e.project].hours += e.hours || 0; byProject[e.project].tasks.push(e.task); });
    return { name: u.name, totalHours: me.reduce((s, e) => s + (e.hours || 0), 0), projects: byProject };
  });
  res.json(report);
});

app.get('/api/email-report', (req, res) => {
  const date = req.query.date || getISTDate();
  const entries = JSON.parse(fs.readFileSync(DATA_FILE)).filter(e => e.date === date);
  const users = JSON.parse(fs.readFileSync(USERS_FILE));
  let email = `Hi Nivedita Avula (TVS Digital),\n\nStatus Update : ${date}\n\n`;
  users.forEach(u => { const me = entries.filter(e => e.member === u.name); if (me.length > 0) { email += `${u.name}:\n`; me.forEach(e => { email += `\u2022 ${e.task} (${e.project} \u2014 ${e.hours}h)${e.jira ? ' [' + e.jira + ']' : ''}\n`; }); email += '\n'; } });
  email += 'Thanks & Regards,\nJothipriya Narayanasamy\nQA Lead \u2014 CPShopBuy QA';
  res.json({ email });
});

app.get('/api/jira/ticket/:key', async (req, res) => {
  try { const r = await jiraRequest('GET', `/rest/api/2/issue/${req.params.key}?fields=summary,status,assignee,issuetype,priority`); if (r.status === 200) { const d = r.data; res.json({ success: true, ticket: { key: d.key, summary: d.fields.summary, status: d.fields.status?.name, assignee: d.fields.assignee?.displayName || 'Unassigned', type: d.fields.issuetype?.name, priority: d.fields.priority?.name } }); } else res.json({ success: false, message: `Jira returned ${r.status}` }); } catch (err) { res.json({ success: false, message: err.message }); }
});

app.post('/api/jira/sync-entry', async (req, res) => {
  const { ticketKey, hours, task, member } = req.body;
  if (!ticketKey || !hours || !task) return res.status(400).json({ success: false, message: 'ticketKey, hours, task required' });
  const results = [];
  try {
    const wl = await jiraRequest('POST', `/rest/api/2/issue/${ticketKey}/worklog`, { timeSpent: `${hours}h`, comment: `[QA Tracker] ${member}: ${task}` });
    results.push({ action: 'Log Work', success: wl.status === 201 });
    const cm = await jiraRequest('POST', `/rest/api/2/issue/${ticketKey}/comment`, { body: `*Daily Update \u2014 ${member}*\n\n${task}\n\n_Hours: ${hours}h | Logged via QA Team Tracker_` });
    results.push({ action: 'Comment', success: cm.status === 201 });
    res.json({ success: results.every(r => r.success), results, message: results.every(r => r.success) ? `Synced to ${ticketKey}` : 'Partial sync' });
  } catch (err) { res.json({ success: false, message: err.message, results }); }
});

app.get('/api/time', (req, res) => {
  res.json({ date: getISTDate(), time: getISTTime(), timezone: 'IST (Asia/Kolkata)' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  QA Team Tracker running on port ${PORT}`);
  console.log(`  Server time (IST): ${getISTDate()} ${getISTTime()}`);
  console.log(`  Open: http://localhost:${PORT}\n`);
});