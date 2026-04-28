const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const query = `
      WITH MemberStats AS (
          -- Menghitung total pinjaman dan tanggal terakhir
          SELECT 
              m.id, 
              m.nim, 
              m.nama,
              COUNT(l.id) AS total_pinjaman,
              MAX(l.loan_date) AS pinjaman_terakhir
          FROM members m
          JOIN loans l ON m.id = l.member_id
          GROUP BY m.id, m.nim, m.nama
      ),
      FavoriteBooks AS (
          -- Mencari buku yang paling sering dipinjam per anggota
          SELECT DISTINCT ON (l.member_id)
              l.member_id,
              b.judul AS buku_favorit,
              COUNT(l.id) AS rent_count
          FROM loans l
          JOIN books b ON l.book_id = b.id
          GROUP BY l.member_id, b.judul
          ORDER BY l.member_id, rent_count DESC
      )
      -- Menggabungkan data dan mengambil Top 3
      SELECT 
          ms.id, 
          ms.nim, 
          ms.nama, 
          ms.total_pinjaman, 
          fb.buku_favorit, 
          ms.pinjaman_terakhir
      FROM MemberStats ms
      LEFT JOIN FavoriteBooks fb ON ms.id = fb.member_id
      ORDER BY ms.total_pinjaman DESC
      LIMIT 3;
    `;

    const { rows } = await pool.query(query);

    const formattedData = rows.map(row => ({
      data_anggota: {
        id: row.id,
        nim: row.nim,
        nama: row.nama
      },
      total_pinjaman: parseInt(row.total_pinjaman, 10),
      buku_favorit: row.buku_favorit,
      pinjaman_terakhir: row.pinjaman_terakhir
    }));

    return res.status(200).json({
      success: true,
      data: formattedData
    });

  } catch (error) {
    console.error('Database Query Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error' 
    });
  }
}