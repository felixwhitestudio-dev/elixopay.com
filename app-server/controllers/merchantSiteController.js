const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

exports.listMerchantSites = async (req, res) => {
  try {
    const { agency_id, status, limit = 50, offset = 0 } = req.query;
    const params = []; const where = [];
    if (agency_id) { params.push(agency_id); where.push(`agency_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    const sql = `SELECT id,name,domain,contact_email,status,agency_id,created_at FROM merchant_sites ${where.length? 'WHERE '+where.join(' AND '): ''} ORDER BY created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit); params.push(offset);
    const r = await pool.query(sql, params);
    res.json({ success:true, data:{ merchantSites: r.rows } });
  } catch(e) {
    res.status(500).json({ success:false, error:{ message:'Failed to list merchant sites' } });
  }
};

exports.createMerchantSite = async (req, res) => {
  try {
    const { agency_id, name, domain, contact_email } = req.body;
    if (!agency_id || !name) return res.status(400).json({ success:false, error:{ message:'agency_id & name required' } });
    const insert = await pool.query(`INSERT INTO merchant_sites (agency_id,name,domain,contact_email) VALUES ($1,$2,$3,$4) RETURNING id,name,agency_id,domain,contact_email,status,created_at`, [agency_id, name, domain || null, contact_email || null]);
    res.status(201).json({ success:true, data:{ merchantSite: insert.rows[0] } });
  } catch(e) {
    res.status(500).json({ success:false, error:{ message:'Failed to create merchant site' } });
  }
};

exports.getMerchantSite = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT id,name,agency_id,domain,contact_email,status,metadata,created_at,updated_at FROM merchant_sites WHERE id=$1`, [id]);
    if (!r.rows.length) return res.status(404).json({ success:false, error:{ message:'Merchant site not found' } });
    res.json({ success:true, data:{ merchantSite: r.rows[0] } });
  } catch(e) {
    res.status(500).json({ success:false, error:{ message:'Failed to get merchant site' } });
  }
};

exports.updateMerchantSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, contact_email, status } = req.body;
    const fields = []; const values = []; let idx=1;
    if (name){ fields.push(`name=$${idx++}`); values.push(name); }
    if (domain){ fields.push(`domain=$${idx++}`); values.push(domain); }
    if (contact_email){ fields.push(`contact_email=$${idx++}`); values.push(contact_email); }
    if (status){ fields.push(`status=$${idx++}`); values.push(status); }
    if (!fields.length) return res.status(400).json({ success:false, error:{ message:'No fields to update' } });
    values.push(id);
    const sql = `UPDATE merchant_sites SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${idx} RETURNING id,name,domain,contact_email,status,agency_id,updated_at`;
    const r = await pool.query(sql, values);
    if (!r.rows.length) return res.status(404).json({ success:false, error:{ message:'Merchant site not found' } });
    res.json({ success:true, data:{ merchantSite: r.rows[0] } });
  } catch(e) {
    res.status(500).json({ success:false, error:{ message:'Failed to update merchant site' } });
  }
};
