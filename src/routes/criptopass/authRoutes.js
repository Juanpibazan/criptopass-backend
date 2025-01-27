const router = require('express').Router();
require('dotenv').config();
const jwt = require('jsonwebtoken');

const connect = require('../../db/connection');
const {encrypt,decrypt} = require('../../utils/helpers');


//middleware para verificar jwt
const verifyTokenMiddleware = (req,res,next)=>{
    const token = req.header('Authorization');
    if(!token){
        res.status(401).json({
            status: false,
            message: 'ERROR. Token incorrecto o no vigente'
        });
    }
    else{
        try {
            const decoded = jwt.verify(token.split(' ')[1],process.env.JWT_SECRET_KEY);
            console.log(decoded);
            req.email=token.email;
            next();
        }catch(e){
            res.status(401).json({
                status: false,
                message: 'ERROR. Token incorrecto o no vigente'
            });
        }
    }
  
};


router.post('/register', async (req,res)=>{
    const {email,password,first_name,last_name,sex,birth_date,type, city, country} = req.body;
    try {
        const pool = await connect();
        const foundUser = await pool.query("SELECT * FROM criptopass_users where email=?",[email]);
        if(foundUser[0].length>0){
            res.status(401).json({
                status: false,
                msg:'Ya existe un usuario con este email, intente con otro.'
            });
        } else{
            const encryptedPass = await encrypt(password);
            const registeredUser = await pool.query("INSERT INTO criptopass_users(email,password,first_name,last_name,sex,birth_date,type, city, country,verified) VALUES (?,?,?,?,?,?,?,?,?,0);",[email,encryptedPass,first_name,last_name,sex,birth_date,type,city,country]);
            if(registeredUser[0].affectedRows===1){
                const token = jwt.sign({
                    email,
                    password:encryptedPass
                },process.env.JWT_SECRET_KEY,{expiresIn:'15m'});
                res.status(201).json({
                    status: true,
                    msg:'Usuario registrado exitosamente.',
                    data:{
                        user:{
                            email,
                            first_name,
                            last_name,
                            sex,
                            type,
                            verified:0
                        },
                        token
                    }
                });

            } else{
                res.status(401).json({
                    status: false,
                    msg:'Ocurrió un error, el usuario no fue registrado.'
                });
            }
        }
    } catch(e){
        res.status(500).json({
            status: false,
            msg:'Ocurrió un error.',
            data: e
        });
    }
});

router.post('/login', async (req,res)=>{
    const {email,password} = req.body;
    try{
        const pool = await connect();
        console.log("POOL:",pool );
        const encryptedPass = await encrypt(password);
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
                    password:encryptedPass
                },process.env.JWT_SECRET_KEY,{expiresIn:'15m'});
                res.status(200).json({
                    status: true,
                    msg:'Credenciales correctas',
                    data:{
                        token,
                        user: loginResponse[0][0]
                    }
                });
            }
        }
    }
    catch(e){
        res.status(500).json({
            status: false,
            message:'Ocurrió un error al iniciar sesión.',
            data: e
        });
    }
});


router.get('/users/:email',verifyTokenMiddleware, async (req,res)=>{
    const {email} = req.params;
    try{
        const pool = await connect();
        const user = await pool.query("SELECT * FROM criptopass_users where email=?",[email]);
        if(user[0].length===1){
            res.status(200).json({
                status: true,
                msg:'Usuario encontrado.',
                data: user[0][0]
            });
        } else {
            res.status(400).json({
                status: false,
                msg:'Usuario no encontrado.'
            });
        }
    } catch(e){
        res.status(500).json({
            status: false,
            msg:'Ocurrió un error.',
            data: e
        });
    }
});


module.exports = router;