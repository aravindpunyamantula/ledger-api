const pool = require("../db");

async function withTransaction(callback){
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const result = await callback(conn);
        await conn.commit();
        return result;

    }catch(e){
        await conn.rollback();
        throw e;

    }finally{
        conn.release();
    }
}
module.exports = withTransaction;