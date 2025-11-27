const db = require('../config/database');

/**
 * GET /api/v1/dashboard
 * Returns role-aware dashboard data for the authenticated user.
 * - Always: user profile + recent sessions (max 5) + total session count
 * - Admin: adds high-level system stats (counts)
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Recent sessions for this user
    const recentSessionsResult = await db.query(
      `SELECT id, created_at, ip_address, user_agent, expires_at
       FROM sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    // Total session count
    const totalSessionsResult = await db.query(
      'SELECT COUNT(*) AS count FROM sessions WHERE user_id = $1',
      [userId]
    );
    const totalSessions = parseInt(totalSessionsResult.rows[0].count, 10) || 0;

    const base = {
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          isVerified: req.user.isVerified
        },
        sessions: {
          total: totalSessions,
          recent: recentSessionsResult.rows
        }
      }
    };

    // If admin, include system-wide stats (lightweight counts)
    if (req.user.role === 'admin') {
      const [usersCount, agenciesCount] = await Promise.all([
        db.query('SELECT COUNT(*) AS count FROM users'),
        db.query('SELECT COUNT(*) AS count FROM agencies')
      ]);
      base.data.stats = {
        totalUsers: parseInt(usersCount.rows[0].count, 10) || 0,
        totalAgencies: parseInt(agenciesCount.rows[0].count, 10) || 0
      };
    }

    return res.json(base);
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to load dashboard' }
    });
  }
};
