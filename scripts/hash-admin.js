import {hashPassword} from '../lib/security.js';
const pwd=process.env.ADMIN_NEW_PASSWORD;
if(!pwd){console.error('Set ADMIN_NEW_PASSWORD in your local shell, then run npm run hash-admin (do not commit it).');process.exit(1)}
console.log(hashPassword(pwd));
