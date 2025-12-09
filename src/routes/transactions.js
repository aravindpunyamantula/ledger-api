const express = require("express");
const router = express.Router();
const pool = require("../db");


async function getBalance(account_id) {
  const [rows] = await pool.query(
    `SELECT 
        SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END) AS balance
     FROM ledger_entries
     WHERE account_id = ?`,
    [account_id]
  );
  return rows[0].balance || 0;
}


router.post("/deposits", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { account_id, amount, currency, description } = req.body;

    if (!account_id || !amount) {
      return res.status(400).json({ error: "account_id and amount required" });
    }

    await conn.beginTransaction();

    // Transaction record
    const [tx] = await conn.query(
      `INSERT INTO transactions
        (type, destination_account_id, amount, currency, status, description)
       VALUES ('deposit', ?, ?, ?, 'pending', ?)`,
      [account_id, amount, currency || 'INR', description || 'Deposit']
    );

    const transactionId = tx.insertId;

    // Ledger credit entry
    await conn.query(
      `INSERT INTO ledger_entries
        (account_id, transaction_id, entry_type, amount)
       VALUES (?, ?, 'credit', ?)`,
      [account_id, transactionId, amount]
    );

    // Mark complete
    await conn.query(
      `UPDATE transactions SET status = 'completed' WHERE id = ?`,
      [transactionId]
    );

    await conn.commit();

    return res.json({
      message: "Deposit successful",
      transaction_id: transactionId
    });

  } catch (e) {
    await conn.rollback();
    console.error("Deposit error:", e);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
});


router.post("/withdrawals", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { account_id, amount, currency, description } = req.body;

    if (!account_id || !amount) {
      return res.status(400).json({ error: "account_id and amount required" });
    }

    const currentBalance = await getBalance(account_id);
    if (currentBalance < amount) {
      return res.status(422).json({ error: "Insufficient balance" });
    }

    await conn.beginTransaction();

    const [tx] = await conn.query(
      `INSERT INTO transactions
        (type, source_account_id, amount, currency, status, description)
       VALUES ('withdrawal', ?, ?, ?, 'pending', ?)`,
      [account_id, amount, currency || 'INR', description || 'Withdrawal']
    );

    const transactionId = tx.insertId;

    // Ledger debit
    await conn.query(
      `INSERT INTO ledger_entries
        (account_id, transaction_id, entry_type, amount)
       VALUES (?, ?, 'debit', ?)`,
      [account_id, transactionId, amount]
    );

    await conn.query(
      `UPDATE transactions SET status = 'completed' WHERE id = ?`,
      [transactionId]
    );

    await conn.commit();

    return res.json({
      message: "Withdrawal successful",
      transaction_id: transactionId
    });

  } catch (e) {
    await conn.rollback();
    console.error("Withdrawal error:", e);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
});


router.post("/transfers", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { from_account, to_account, amount, currency, description } = req.body;

    if (!from_account || !to_account || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (from_account === to_account) {
      return res.status(400).json({ error: "Cannot transfer to same account" });
    }

    const balance = await getBalance(from_account);
    if (balance < amount) {
      return res.status(422).json({ error: "Insufficient balance" });
    }

    await conn.beginTransaction();

    const [tx] = await conn.query(
      `INSERT INTO transactions
        (type, source_account_id, destination_account_id, amount, currency, status, description)
       VALUES ('transfer', ?, ?, ?, ?, 'pending', ?)`,
      [from_account, to_account, amount, currency || 'INR', description || 'Transfer']
    );

    const transactionId = tx.insertId;

    
    await conn.query(
      `INSERT INTO ledger_entries
        (account_id, transaction_id, entry_type, amount)
       VALUES (?, ?, 'debit', ?)`,
      [from_account, transactionId, amount]
    );

    // Credit destination
    await conn.query(
      `INSERT INTO ledger_entries
        (account_id, transaction_id, entry_type, amount)
       VALUES (?, ?, 'credit', ?)`,
      [to_account, transactionId, amount]
    );

    await conn.query(
      `UPDATE transactions SET status = 'completed' WHERE id = ?`,
      [transactionId]
    );

    await conn.commit();

    return res.json({
      message: "Transfer successful",
      transaction_id: transactionId
    });

  } catch (e) {
    await conn.rollback();
    console.error("Transfer error:", e);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
});

module.exports = router;
