const mysql = require('mysql2/promise');
require('dotenv').config();

const connect = async ()=>{
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database:'bridge'
    })
    return connection;
};

module.exports = connect;