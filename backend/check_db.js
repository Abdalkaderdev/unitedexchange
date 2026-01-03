const mysql = require("mysql2/promise");
require("dotenv").config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // Check active shifts
  const [shifts] = await conn.query("SELECT id, uuid, status FROM shifts WHERE status = ?", ["active"]);
  console.log("Active shifts:", JSON.stringify(shifts, null, 2));

  // Check shift_summaries columns
  const [cols] = await conn.query("DESCRIBE shift_summaries");
  console.log("shift_summaries columns:", cols.map(c => c.Field).join(", "));

  // Try to end shift if there's an active one
  if (shifts.length > 0) {
    console.log("\nAttempting to end shift:", shifts[0].uuid);

    // Get shift details
    const [shiftDetails] = await conn.query("SELECT * FROM shifts WHERE id = ?", [shifts[0].id]);
    console.log("Shift details:", JSON.stringify(shiftDetails[0], null, 2));

    // Check if shift_summaries exists for this shift
    const [summary] = await conn.query("SELECT * FROM shift_summaries WHERE shift_id = ?", [shifts[0].id]);
    console.log("Shift summary exists:", summary.length > 0);
  }

  await conn.end();
})();
