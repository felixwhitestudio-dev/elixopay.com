const { Pool } = require('pg');

// Reuse environment-based pool config (simple instantiation for now)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper: basic role check (expand later with agency_members table)
function ensureAdmin(req, res) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    res.status(403).json({ success: false, error: { message: 'Admin only' } });
    return false;
  }
  return true;
}

exports.listAgencies = async (req, res) => {
  try {
    const { parent_id, search, limit = 50, offset = 0 } = req.query;
    const params = [];
    let where = [];
    if (parent_id) { params.push(parent_id); where.push(`parent_id = $${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`); }
    const sql = `SELECT id,name,code,parent_id,status,created_at FROM agencies ${where.length? 'WHERE '+where.join(' AND '): ''} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit); params.push(offset);
    const result = await pool.query(sql, params);
    res.json({ success: true, data: { agencies: result.rows } });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: 'Failed to list agencies' } });
  }
};

exports.createAgency = async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  try {
    const { name, code, parent_id } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, error: { message: 'name & code required' } });
    }
    const insert = await pool.query(`INSERT INTO agencies (name, code, parent_id) VALUES ($1,$2,$3) RETURNING id,name,code,parent_id,status,created_at`, [name, code, parent_id || null]);
    res.status(201).json({ success: true, data: { agency: insert.rows[0] } });
  } catch (e) {
    if (e.code === '23505') { // unique violation
      return res.status(409).json({ success: false, error: { message: 'Agency code already exists' } });
    }
    res.status(500).json({ success: false, error: { message: 'Failed to create agency' } });
  }
};

exports.getAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT id,name,code,parent_id,status,metadata,created_at,updated_at FROM agencies WHERE id=$1`, [id]);
    if (!r.rows.length) return res.status(404).json({ success: false, error: { message: 'Agency not found' } });
    res.json({ success: true, data: { agency: r.rows[0] } });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: 'Failed to get agency' } });
  }
};

exports.createSubAgency = async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, error: { message: 'name & code required' } });
    // verify parent exists
    const parent = await pool.query(`SELECT id FROM agencies WHERE id=$1`, [id]);
    if (!parent.rows.length) return res.status(404).json({ success: false, error: { message: 'Parent agency not found' } });
    const insert = await pool.query(`INSERT INTO agencies (name, code, parent_id) VALUES ($1,$2,$3) RETURNING id,name,code,parent_id,status`, [name, code, id]);
    res.status(201).json({ success: true, data: { subAgency: insert.rows[0] } });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: 'Failed to create sub-agency' } });
  }
};

// Agency members basic (Phase1 minimal - no deep permission checks yet)
exports.listMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT m.id, m.role_in_agency, m.is_active, u.id AS user_id, u.email, u.name FROM agency_members m JOIN users u ON u.id = m.user_id WHERE m.agency_id=$1 ORDER BY m.created_at DESC`, [id]);
    res.json({ success: true, data: { members: r.rows } });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: 'Failed to list members' } });
  }
};

exports.addMember = async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  try {
    const { id } = req.params; // agency id
    const { user_id, role_in_agency } = req.body;
    if (!user_id || !role_in_agency) return res.status(400).json({ success: false, error: { message: 'user_id & role_in_agency required' } });
    const allowed = ['owner','manager','finance','support'];
    if (!allowed.includes(role_in_agency)) return res.status(400).json({ success: false, error: { message: 'Invalid role_in_agency' } });
    const insert = await pool.query(`INSERT INTO agency_members (agency_id, user_id, role_in_agency) VALUES ($1,$2,$3) RETURNING id,agency_id,user_id,role_in_agency,is_active,created_at`, [id, user_id, role_in_agency]);
    res.status(201).json({ success: true, data: { member: insert.rows[0] } });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, error: { message: 'User already in agency' } });
    res.status(500).json({ success: false, error: { message: 'Failed to add member' } });
  }
};
