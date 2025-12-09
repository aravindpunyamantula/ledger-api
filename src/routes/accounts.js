const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/", async (req, res) => {
    try {
        const { user_id, account_type, currency } = req.body;
        if (!user_id || !account_type) {
            return res.status(400).json({ error: "user_id and account_type are required." });
        }

        const [result] = await pool.query(
            `INSERT INTO accounts (user_id, account_type, currency) VALUES(?, ?, ?)`,
            [user_id, account_type, currency || 'INR']
        );

        return res.json({
            message: "Account created",
            account_id: result.insertId
        })

    } catch (e) {
        console.error("Create account error: ", e);
        res.status(500).json({ error: "Internal server error" });

    }
});

router.get("/:id", async (req, res) => {
    try {
        const accountId = req.params.id;
        const [rows] = await pool.query(
            "select * from accounts where id = ?",
            [accountId]
        )

        if (rows.length === 0) {
            return res.status(404).json({ error: "Account not found" });
        }

        const account = rows[0];

        const [ledgerRows] = await pool.query(
            `select 
            SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END) AS balance
            FROM ledger_entries
            where account_id = ?
            `,
            [accountId]
        );

        account.balance = ledgerRows[0].balance || 0;

        return res.json(account);

    } catch (e) {
        console.error("Fetch account error:", err);
        res.status(500).json({ error: "Internal server error" });

    }
});

router.get("/:id/ledger",async (req, res)=>{
   try{
     const id = req.params.id;
    const [balance] = await pool.query(
        `SELECT * FROM ledger_entries where account_id = ? order by created_at asc`,
        [id]
       
    )
    return res.json(balance);

   }catch(e){
    res.status(500).json({error: "Internal Server error"});

   }
})

module.exports = router;