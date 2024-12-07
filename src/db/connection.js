const mysql = require('mysql2/promise');
require('dotenv').config();

const connect = async ()=>{
    const connection = await mysql.createConnection({
        host: 'localhost',
        //host:'193.203.174.82',
        //port: 3306,
        user: 'root',
        password:'Banco_Trabajos123.',
        database:'banco_trabajos'
    })
    return connection;
};

module.exports = connect;