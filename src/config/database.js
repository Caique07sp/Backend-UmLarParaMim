const { Pool } = require('pg'); //Importa o Pool do pg - Biblioteca para conectar ao banco de dados PostgreSQL

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST ,
    database: process.env.DB_NAME ,
    password: process.env.DB_PASSWORD ,
    port: process.env.DB_PORT || 5432,
})

module.exports = pool;