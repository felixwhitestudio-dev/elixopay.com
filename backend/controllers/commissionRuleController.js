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

function ensureAdmin(req, res) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    res.status(403).json({ success:false, error:{ message:'Admin only' }});
    return false;
  }
  return true;
}

exports.listCommissionRules = async (req, res) => {
  try {
    const { agency_id, active=true } = req.query;
    if (!agency_id) return res.status(400).json({ success:false, error:{ message:'agency_id required' }});
    const r = await pool.query(`SELECT id,agency_id,level,model,percent_value,flat_amount,min_amount,max_amount,is_active,created_at FROM commission_rules WHERE agency_id=$1 ${active? 'AND is_active=true':''} ORDER BY created_at DESC`, [agency_id]);
    res.json({ success:true, data:{ commissionRules: r.rows } });
  } catch(e){
    res.status(500).json({ success:false, error:{ message:'Failed to list commission rules' }});
  }
};

exports.createCommissionRule = async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  try {
    const { agency_id, level, model, percent_value, flat_amount, min_amount, max_amount, tier_json } = req.body;
    if (!agency_id || !level || !model) return res.status(400).json({ success:false, error:{ message:'agency_id, level, model required' }});
    const allowedLevels = ['DIRECT','SUB_AGENCY','MERCHANT'];
    const allowedModels = ['PERCENT','FLAT','TIER'];
    if (!allowedLevels.includes(level) || !allowedModels.includes(model)) {
      return res.status(400).json({ success:false, error:{ message:'Invalid level or model' }});
    }
    const insert = await pool.query(`INSERT INTO commission_rules (agency_id,level,model,percent_value,flat_amount,min_amount,max_amount,tier_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,agency_id,level,model,percent_value,flat_amount,min_amount,max_amount,is_active,created_at`, [agency_id, level, model, percent_value || null, flat_amount || null, min_amount || null, max_amount || null, tier_json || null]);
    res.status(201).json({ success:true, data:{ commissionRule: insert.rows[0] } });
  } catch(e){
    res.status(500).json({ success:false, error:{ message:'Failed to create commission rule' }});
  }
};

exports.deactivateCommissionRule = async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const r = await pool.query(`UPDATE commission_rules SET is_active=false WHERE id=$1 RETURNING id,agency_id,is_active`, [id]);
    if (!r.rows.length) return res.status(404).json({ success:false, error:{ message:'Rule not found' }});
    res.json({ success:true, data:{ commissionRule: r.rows[0] } });
  } catch(e){
    res.status(500).json({ success:false, error:{ message:'Failed to deactivate rule' }});
  }
};
