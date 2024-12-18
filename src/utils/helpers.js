const bcrypt = require('bcryptjs');


const helpers = {};

helpers.encrypt = async (pass)=>{
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(pass,salt);
    return hashedPass;
};


helpers.decrypt = async (pass, encryptedPass)=>{
    return await bcrypt.compare(pass, encryptedPass);
};

module.exports = helpers;