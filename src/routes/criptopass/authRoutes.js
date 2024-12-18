const router = require('express').Router();
require('dotenv').config();
const jwt = require('jsonwebtoken');

const connect = require('../../db/connection');
const {encrypt,decrypt} = require('../../utils/helpers');

router.post('/login', async (req,res)=>{
    const {email,password} = req.body;
    try{
        const pool = await connect();
        const loginResponse = await pool.query("SELECT * FROM criptopass_users where email=?",[email]);
        if(loginResponse[0].length===0){
            res.status(401).json({status: false,message:'ERROR, Usuario inexistente o no vigente'});
        } else{
            const verified = decrypt(password,loginResponse[0][0].password);
            if(!verified){
                res.status(401).json({status: false,message:'ERROR, Contraseña incorrecta'});
            } else{
                const token = jwt.sign({
                    email,
                    password
                },process.env.JWT_SECRET_KEY,{expiresIn:'15m'});
                res.status(200).json({
                    status: true,
                    message:'Credenciales correctas',
                    token
                });
            }
        }
    }


});


module.exports = router;