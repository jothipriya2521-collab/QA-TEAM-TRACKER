const express = require('express');
const path = require('path');
const https = require('https');
const { MongoClient, ObjectId } = require('mongodb');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/qa-team-tracker';

const JIRA_HOST = process.env.JIRA_HOST || 'tvsmotorcompany.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';
const JIRA_AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

let db;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  console.log('  Connected to MongoDB');
  await seedData();
}

async function seedData() {
  const usersCol = db.collection('users');
  const count = await usersCol.countDocuments();
  if (count === 0) {
    await usersCol.insertMany([
      { id: 1, name: 'Jothipriya', role: 'lead', password: 'jothi123', projects: ['Norton Phase 2', 'IOM', 'RFC Migration', 'EMS Automation', 'DMS Automation', 'Training', 'Learning'] },
      { id: 2, name: 'Vimala', role: 'member', password: 'vimala123', projects: ['Digi App', 'Norton Phase 2', 'RFC Migration'] },
      { id: 3, name: 'Sureshrajendran', role: 'member', password: 'suresh123', projects: ['Norton Phase 2', 'DMS Automation', 'RFC Migration'] },
      { id: 4, name: 'Talent', role: 'trainee', password: 'talent123', projects: ['Learning', 'Training', 'Norton Phase 2', 'RFC Migration'] },
      { id: 5, name: 'Thillai', role: 'manager', password: 'thillai123', projects: [] },
      { id: 6, name: 'Sureshkannan', role: 'manager', password: 'sureshk123', projects: [] },
      { id: 7, name: 'Nivedhitha', role: 'manager', password: 'nivedhitha123', projects: [] }
    ]);
    console.log('  Seeded users');
  }
}

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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Login
app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  const user = await db.collection('users').findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, password });
  if (user) res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, projects: user.projects } });
  else res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// Change password
app.post('/api/change-password', async (req, res) => {
  const { name, oldPassword, newPassword } = req.body;
  if (!name || !oldPassword || !newPassword) return res.status(400).json({ success: false, message: 'All fields required' });
  const user = await db.collection('users').findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') }, password: oldPassword });
  if (!user) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  await db.collection('users').updateOne({ _id: user._id }, { $set: { password: newPassword } });
  res.json({ success: true, message: 'Password changed successfully' });
});

// Get entries
app.get('/api/entries', async (req, res) => {
  const { date, fromDate, toDate, member, project, status } = req.query;
  let filter = {};
  if (date) filter.date = date;
  if (fromDate && toDate) filter.date = { $gte: fromDate, $lte: toDate };
  else if (fromDate) filter.date = { $gte: fromDate };
  else if (toDate) filter.date = { $lte: toDate };
  if (member) filter.member = member;
  if (project) filter.project = project;
  if (status) filter.status = status;
  const entries = await db.collection('entries').find(filter).sort({ _id: -1 }).toArray();
  res.json(entries);
});

// Get pending tasks
app.get('/api/pending-tasks', async (req, res) => {
  const entries = await db.collection('entries').find({ status: { $in: ['In Progress', 'Blocked'] } }).toArray();
  const grouped = {};
  entries.forEach(e => { if (!grouped[e.member]) grouped[e.member] = []; grouped[e.member].push(e); });
  res.json({ pendingTasks: entries, grouped, total: entries.length });
});

// Create entry
app.post('/api/entries', async (req, res) => {
  const entry = { id: Date.now(), date: getISTDate(), time: getISTTime(), reviewNotes: [], ...req.body };
  await db.collection('entries').insertOne(entry);
  res.json({ success: true, entry });
});

// Add review note
app.post('/api/entries/:id/review', async (req, res) => {
  const { by, text, role } = req.body;
  if (!by || !text) return res.status(400).json({ success: false, message: 'Name and note text required' });
  if (role !== 'manager' && role !== 'lead') return res.status(403).json({ success: false, message: 'Only managers and lead can add review notes' });
  const entry = await db.collection('entries').findOne({ id: parseInt(req.params.id) });
  if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
  const note = { by, text, time: `${getISTDate()} ${getISTTime()}` };
  await db.collection('entries').updateOne({ id: parseInt(req.params.id) }, { $push: { reviewNotes: note } });
  res.json({ success: true, message: 'Review note added' });
});

// Delete entry
app.delete('/api/entries/:id', async (req, res) => {
  await db.collection('entries').deleteOne({ id: parseInt(req.params.id) });
  res.json({ success: true });
});

// Stats
app.get('/api/stats', async (req, res) => {
  const today = getISTDate();
  const users = await db.collection('users').find({}).toArray();
  const teamMembers = users.filter(u => u.role !== 'manager');
  const todayEntries = await db.collection('entries').find({ date: today }).toArray();
  const membersUpdated = [...new Set(todayEntries.map(e => e.member))];
  const pendingTasks = await db.collection('entries').find({ status: { $in: ['In Progress', 'Blocked'] } }).toArray();
  const memberStats = teamMembers.map(u => {
    const me = todayEntries.filter(e => e.member === u.name);
    const myPending = pendingTasks.filter(e => e.member === u.name);
    return { name: u.name, role: u.role, submitted: me.length > 0, hours: me.reduce((s, e) => s + (e.hours || 0), 0), projects: [...new Set(me.map(e => e.project))], entries: me, pendingCount: myPending.length };
  });
  res.json({ today, totalEntries: todayEntries.length, totalHours: todayEntries.reduce((s, e) => s + (e.hours || 0), 0), totalMembers: teamMembers.length, pending: teamMembers.length - teamMembers.filter(u => membersUpdated.includes(u.name)).length, pendingMembers: teamMembers.filter(u => !membersUpdated.includes(u.name)).map(u => u.name), memberStats, totalPendingTasks: pendingTasks.length });
});

// Weekly report
app.get('/api/weekly', async (req, res) => {
  const users = await db.collection('users').find({}).toArray();
  const now = new Date(); const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEntries = await db.collection('entries').find({ date: { $gte: weekStart.toISOString().split('T')[0] } }).toArray();
  const report = users.map(u => {
    const me = weekEntries.filter(e => e.member === u.name); const byProject = {};
    me.forEach(e => { if (!byProject[e.project]) byProject[e.project] = { hours: 0, tasks: [] }; byProject[e.project].hours += e.hours || 0; byProject[e.project].tasks.push(e.task); });
    return { name: u.name, totalHours: me.reduce((s, e) => s + (e.hours || 0), 0), projects: byProject };
  });
  res.json(report);
});

// Email report
app.get('/api/email-report', async (req, res) => {
  const date = req.query.date || getISTDate();
  const loggedInUser = req.query.user || 'Jothipriya';
  const entries = await db.collection('entries').find({ date }).toArray();
  const users = await db.collection('users').find({}).toArray();
  
  // Signature mapping based on logged-in user
  const signatures = {
    'Jothipriya': 'Thanks & Regards,\nJothipriya Narayanasamy\nQA Lead \u2014 CPShopBuy QA',
    'Thillai': 'Thanks & Regards,\nThillai Nayagam\nManager \u2014 CPShopBuy QA',
    'Sureshkannan': 'Thanks & Regards,\nSuresh Kannan\nManager \u2014 CPShopBuy QA',
    'Nivedhitha': 'Thanks & Regards,\nNivedhitha Avula\nManager \u2014 TVS Digital'
  };
  const signature = signatures[loggedInUser] || `Thanks & Regards,\n${loggedInUser}`;
  
  let email = `Hi Nivedita Avula (TVS Digital),\n\nStatus Update : ${date}\n\n`;
  users.forEach(u => { const me = entries.filter(e => e.member === u.name); if (me.length > 0) { email += `${u.name}:\n`; me.forEach(e => { const hrs=Math.floor(e.hours);const mins=Math.round((e.hours-hrs)*60);let timeStr='';if(hrs>0&&mins>0)timeStr=hrs+'h '+mins+'m';else if(hrs>0)timeStr=hrs+'h';else timeStr=mins+'m'; email += `\u2022 ${e.task} (${e.project} \u2014 ${timeStr})\n`; }); email += '\n'; } });
  email += signature;
  res.json({ email });
});

// Jira ticket
app.get('/api/jira/ticket/:key', async (req, res) => {
  try { const r = await jiraRequest('GET', `/rest/api/2/issue/${req.params.key}?fields=summary,status,assignee,issuetype,priority`); if (r.status === 200) { const d = r.data; res.json({ success: true, ticket: { key: d.key, summary: d.fields.summary, status: d.fields.status?.name, assignee: d.fields.assignee?.displayName || 'Unassigned', type: d.fields.issuetype?.name, priority: d.fields.priority?.name } }); } else res.json({ success: false, message: `Jira returned ${r.status}` }); } catch (err) { res.json({ success: false, message: err.message }); }
});

// Jira sync
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

// Time
app.get('/api/time', (req, res) => {
  res.json({ date: getISTDate(), time: getISTTime(), timezone: 'IST (Asia/Kolkata)' });
});

// Start server
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  QA Team Tracker running on port ${PORT}`);
    console.log(`  Server time (IST): ${getISTDate()} ${getISTTime()}`);
    console.log(`  Open: http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});
