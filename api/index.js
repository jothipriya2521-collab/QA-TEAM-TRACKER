const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const TMP_ENTRIES = '/tmp/entries.json';
const TMP_USERS = '/tmp/users.json';

const DEFAULT_USERS = [
  { id: 1, name: 'Jothipriya', role: 'lead', password: 'jothi123', projects: ['Norton Phase 2', 'IOM', 'RFC Migration', 'EMS Automation', 'DMS Automation'] },
  { id: 2, name: 'Vimala', role: 'member', password: 'vimala123', projects: ['Digi App', 'Norton Phase 2', 'RFC Migration'] },
  { id: 3, name: 'Sureshrajendran', role: 'member', password: 'suresh123', projects: ['Norton Phase 2', 'DMS Automation', 'RFC Migration'] },
  { id: 4, name: 'Talent', role: 'trainee', password: 'talent123', projects: ['Learning', 'Norton Phase 2', 'RFC Migration'] },
  { id: 5, name: 'Thillai', role: 'manager', password: 'thillai123', projects: [] },
  { id: 6, name: 'Sureshkannan', role: 'manager', password: 'sureshk123', projects: [] },
  { id: 7, name: 'Nivedhitha', role: 'manager', password: 'nivedhitha123', projects: [] }
];

function getEntries() {
  try { if (fs.existsSync(TMP_ENTRIES)) return JSON.parse(fs.readFileSync(TMP_ENTRIES, 'utf8')); } catch (e) {}
  return [];
}
function saveEntries(entries) { fs.writeFileSync(TMP_ENTRIES, JSON.stringify(entries, null, 2)); }
function getUsers() {
  try { if (fs.existsSync(TMP_USERS)) return JSON.parse(fs.readFileSync(TMP_USERS, 'utf8')); } catch (e) {}
  fs.writeFileSync(TMP_USERS, JSON.stringify(DEFAULT_USERS, null, 2));
  return DEFAULT_USERS;
}

const JIRA_HOST = process.env.JIRA_HOST || 'tvsmotorcompany.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';
const JIRA_AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

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

app.use(express.json());

app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  const users = getUsers();
  const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
  if (user) res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, projects: user.projects } });
  else res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.get('/api/entries', (req, res) => {
  const { date, member, project } = req.query;
  let entries = getEntries();
  if (date) entries = entries.filter(e => e.date === date);
  if (member) entries = entries.filter(e => e.member === member);
  if (project) entries = entries.filter(e => e.project === project);
  res.json(entries);
});

app.post('/api/entries', (req, res) => {
  const entry = { id: Date.now(), date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), ...req.body };
  const entries = getEntries();
  entries.unshift(entry);
  saveEntries(entries);
  res.json({ success: true, entry });
});

app.delete('/api/entries/:id', (req, res) => {
  let entries = getEntries();
  entries = entries.filter(e => e.id !== parseInt(req.params.id));
  saveEntries(entries);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const entries = getEntries();
  const users = getUsers();
  const teamMembers = users.filter(u => u.role !== 'manager');
  const todayEntries = entries.filter(e => e.date === today);
  const membersUpdated = [...new Set(todayEntries.map(e => e.member))];
  const memberStats = teamMembers.map(u => {
    const me = todayEntries.filter(e => e.member === u.name);
    return { name: u.name, role: u.role, submitted: me.length > 0, hours: me.reduce((s, e) => s + (e.hours || 0), 0), projects: [...new Set(me.map(e => e.project))], entries: me };
  });
  res.json({ today, totalEntries: todayEntries.length, totalHours: todayEntries.reduce((s, e) => s + (e.hours || 0), 0), totalMembers: teamMembers.length, pending: teamMembers.length - teamMembers.filter(u => membersUpdated.includes(u.name)).length, pendingMembers: teamMembers.filter(u => !membersUpdated.includes(u.name)).map(u => u.name), memberStats });
});

app.get('/api/weekly', (req, res) => {
  const entries = getEntries(); const users = getUsers();
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
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const entries = getEntries().filter(e => e.date === date); const users = getUsers();
  let email = `Hi Nivedita Avula (TVS Digital),\n\nStatus Update : ${date}\n\n`;
  users.forEach(u => { const me = entries.filter(e => e.member === u.name); if (me.length > 0) { email += `${u.name}:\n`; me.forEach(e => { email += `ΓÇó ${e.task} (${e.project} ΓÇö ${e.hours}h)${e.jira ? ' [' + e.jira + ']' : ''}\n`; }); email += '\n'; } });
  email += 'Thanks & Regards,\nJothipriya Narayanasamy\nQA Lead ΓÇö CPShopBuy QA';
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
    const cm = await jiraRequest('POST', `/rest/api/2/issue/${ticketKey}/comment`, { body: `*Daily Update ΓÇö ${member}*\n\n${task}\n\n_Hours: ${hours}h | Logged via QA Team Tracker_` });
    results.push({ action: 'Comment', success: cm.status === 201 });
    res.json({ success: results.every(r => r.success), results, message: results.every(r => r.success) ? `Synced to ${ticketKey}` : 'Partial sync' });
  } catch (err) { res.json({ success: false, message: err.message, results }); }
});

module.exports = app;