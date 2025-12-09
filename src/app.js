const express = require("express");
const app = express();

app.use(express.json());

app.get('/health', (req, res)=>{
    res.json({status: 'ok', time: new Date().toISOString});
});

const accountsRouter = require('./routes/accounts');
app.use('/accounts', accountsRouter);

const transactionsRouter = require("./routes/transactions");
app.use("/", transactionsRouter);


module.exports = app;