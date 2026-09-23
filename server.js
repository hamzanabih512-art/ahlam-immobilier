const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join('/tmp', 'data');
const UPLOAD_DIR = path.join('/tmp', 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET = process.env.JWT_SECRET || 'change-this-secret-before-production';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const img = (url) => ({ image: url, images: [url] });
const initialDb = {
  settings: {
    siteName: 'Ahlam Immobilier', tagline: 'Des biens, des projets, une seule adresse.',
    phone: '+212 6 00 00 00 00', whatsapp: '212600000000', email: 'contact@ahlam-immobilier.ma',
    hity: 'Tanger • Tétouan • Nord du Maroc', heroTitle: 'Trouvez votre prochain chez-vous',
    heroText: 'Découvrez nos résidences, appartements et opportunités immobilières sélectionnées dans le Nord du Maroc.',
    logoText: 'A', logoImage: '', primaryColor: '#173B4A'
  },
  projects: [
    { id:'p1', name:'Résidence Al Bahja', city:'Tanger', neighborhood:'Malabata', status:'Disponible', type:'Résidence', description:'Une résidence moderne proche des commodités, pensée pour une vie confortable.', priceFrom:890000, areaFrom:78, bedroomsFrom:2, featured:true, ...img('https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85') },
    { id:'p2', name:'Les Jardins de Tétouan', city:'Tétouan', neighborhood:'Centre', status:'Nouveauté', type:'Résidence', description:'Des appartements lumineux avec une architecture contemporaine et des espaces agréables.', priceFrom:620000, areaFrom:64, bedroomsFrom:2, featured:true, ...img('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85') },
    { id:'p3', name:'Cap Spartel Villas', city:'Tanger', neighborhood:'Cap Spartel', status:'Sur plan', type:'Villas', description:'Un programme résidentiel premium dans un environnement privilégié.', priceFrom:1850000, areaFrom:180, bedroomsFrom:4, featured:true, ...img('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85') }
  ],
  units: [
    {id:'u1', projectId:'p1', ref:'A101', title:'Appartement 2 chambres', type:'Appartement', floor:1, area:82, bedrooms:2, bathrooms:1, price:890000, status:'Disponible', ...img('https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=80')},
    {id:'u2', projectId:'p1', ref:'B203', title:'Appartement 3 chambres', type:'Appartement', floor:2, area:112, bedrooms:3, bathrooms:2, price:1180000, status:'Disponible', ...img('https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=80')},
    {id:'u3', projectId:'p2', ref:'C104', title:'Appartement familial', type:'Appartement', floor:1, area:95, bedrooms:3, bathrooms:2, price:790000, status:'Réservé', ...img('https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=80')},
    {id:'u4', projectId:'p3', ref:'V01', title:'Villa 4 chambres', type:'Villa', floor:0, area:210, bedrooms:4, bathrooms:3, price:2150000, status:'Disponible', ...img('https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80')}
  ],
  inquiries: []
};

if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
function readDb(){ return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
function writeDb(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
function id(prefix='id'){ return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function auth(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');
  try { req.user=jwt.verify(token,SECRET); next(); } catch { res.status(401).json({error:'Non autorisé'}); }
}
function cleanImages(value){
  const arr=Array.isArray(value)?value.filter(x=>typeof x==='string' && x.trim()):[];
  return [...new Set(arr)].slice(0,30);
}
function normalizeEntity(obj){
  const images=cleanImages(obj.images?.length?obj.images:(obj.image?[obj.image]:[]));
  return {...obj, images, image: images[0]||''};
}

const storage=multer.diskStorage({
  destination:(_,__,cb)=>cb(null,UPLOAD_DIR),
  filename:(_,file,cb)=>{
    const ext=path.extname(file.originalname).toLowerCase();
    cb(null,crypto.randomBytes(10).toString('hex')+ext);
  }
});
const allowed=new Set(['image/jpeg','image/png','image/webp','image/svg+xml']);
const upload=multer({
  storage,
  limits:{fileSize:8*1024*1024,files:30},
  fileFilter:(_,file,cb)=>cb(null,allowed.has(file.mimetype))
});

app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
app.use('/uploads',express.static(UPLOAD_DIR,{maxAge:'7d'}));
app.use(express.static(path.join(ROOT,'public')));

app.get('/api/public',(req,res)=>{ const db=readDb(); res.json({settings:db.settings,projects:db.projects.map(normalizeEntity),units:db.units.map(normalizeEntity)}); });

app.post('/api/login',async(req,res)=>{
  const {username,password}=req.body||{};
  const adminUser=process.env.ADMIN_USER||'admin';
  const db=readDb(); const adminHash=process.env.ADMIN_PASSWORD_HASH||db.adminPasswordHash||bcrypt.hashSync('admin123',10);
  if(username===adminUser && typeof password==='string' && await bcrypt.compare(password,adminHash)) return res.json({token:jwt.sign({username},SECRET,{expiresIn:'8h'}),username});
  res.status(401).json({error:'Identifiants incorrects'});
});

app.get('/api/admin/data',auth,(req,res)=>res.json(readDb()));
app.post('/api/admin/password',auth,async(req,res)=>{
  const {current,next}=req.body||{};
  if(!current||typeof next!=='string'||next.length<8)return res.status(400).json({error:'Mot de passe invalide (8 caractères minimum)'});
  const configuredHash=process.env.ADMIN_PASSWORD_HASH;
  if(configuredHash)return res.status(400).json({error:'Le mot de passe est géré par ADMIN_PASSWORD_HASH.'});
  const db=readDb();
  db.adminPasswordHash=db.adminPasswordHash||bcrypt.hashSync('admin123',10);
  if(!(await bcrypt.compare(current,db.adminPasswordHash)))return res.status(400).json({error:'Mot de passe actuel incorrect'});
  db.adminPasswordHash=await bcrypt.hash(next,10);
  writeDb(db);
  res.json({ok:true});
});
app.put('/api/admin/settings',auth,(req,res)=>{ const db=readDb(); db.settings={...db.settings,...req.body}; writeDb(db); res.json(db.settings); });

app.post('/api/admin/projects',auth,(req,res)=>{ const db=readDb(); const p=normalizeEntity({id:id('p'),...req.body}); p.priceFrom=Number(p.priceFrom||0);p.areaFrom=Number(p.areaFrom||0);p.bedroomsFrom=Number(p.bedroomsFrom||0);db.projects.unshift(p);writeDb(db);res.json(p); });
app.put('/api/admin/projects/:id',auth,(req,res)=>{ const db=readDb();const i=db.projects.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Projet introuvable'});db.projects[i]=normalizeEntity({...db.projects[i],...req.body});writeDb(db);res.json(db.projects[i]); });
app.delete('/api/admin/projects/:id',auth,(req,res)=>{ const db=readDb();db.projects=db.projects.filter(x=>x.id!==req.params.id);db.units=db.units.filter(x=>x.projectId!==req.params.id);writeDb(db);res.json({ok:true}); });

app.post('/api/admin/units',auth,(req,res)=>{ const db=readDb();const u=normalizeEntity({id:id('u'),...req.body});['floor','area','bedrooms','bathrooms','price'].forEach(k=>u[k]=Number(u[k]||0));db.units.unshift(u);writeDb(db);res.json(u); });
app.put('/api/admin/units/:id',auth,(req,res)=>{ const db=readDb();const i=db.units.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Bien introuvable'});db.units[i]=normalizeEntity({...db.units[i],...req.body});['floor','area','bedrooms','bathrooms','price'].forEach(k=>db.units[i][k]=Number(db.units[i][k]||0));writeDb(db);res.json(db.units[i]); });
app.delete('/api/admin/units/:id',auth,(req,res)=>{ const db=readDb();db.units=db.units.filter(x=>x.id!==req.params.id);writeDb(db);res.json({ok:true}); });

app.post('/api/inquiries',(req,res)=>{ const {name,phone,email,message,unitId}=req.body||{};if(!name||!phone)return res.status(400).json({error:'Nom et téléphone requis'});const db=readDb();db.inquiries.unshift({id:id('i'),createdAt:new Date().toISOString(),name:String(name).slice(0,120),phone:String(phone).slice(0,60),email:String(email||'').slice(0,160),message:String(message||'').slice(0,2000),unitId:unitId||''});writeDb(db);res.json({ok:true}); });
app.delete('/api/admin/inquiries/:id',auth,(req,res)=>{ const db=readDb();db.inquiries=db.inquiries.filter(x=>x.id!==req.params.id);writeDb(db);res.json({ok:true}); });

app.post('/api/admin/upload',auth,upload.array('images',30),(req,res)=>{ if(!req.files?.length)return res.status(400).json({error:'Aucune image valide'});res.json({urls:req.files.map(f=>'/uploads/'+f.filename)}); });
app.delete('/api/admin/uploads',auth,(req,res)=>{ const urls=Array.isArray(req.body?.urls)?req.body.urls:[];for(const u of urls){if(typeof u!=='string'||!u.startsWith('/uploads/'))continue;const name=path.basename(u);const file=path.join(UPLOAD_DIR,name);if(fs.existsSync(file))try{fs.unlinkSync(file)}catch{}}res.json({ok:true}); });

app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
app.listen(PORT,()=>console.log(`Site prêt sur http://localhost:${PORT}`));
