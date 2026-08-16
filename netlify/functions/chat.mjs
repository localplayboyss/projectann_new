// ANN — режим БЕЗ AI/API
// Netlify Function: /.netlify/functions/chat

const SIGNS = ['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы'];
const PLANETS = ['Луна','Солнце','Марс','Меркурий','Венера','Юпитер','Сатурн','Узлы','Стихии'];
const SIGN_HOUSE = {Овен:1,Телец:2,Близнецы:3,Рак:4,Лев:5,Дева:6,Весы:7,Скорпион:8,Стрелец:9,Козерог:10,Водолей:11,Рыбы:12};

const norm = s => String(s ?? '').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}\s.-]/gu,' ').replace(/\s+/g,' ').trim();
const words = s => [...new Set(norm(s).split(' ').filter(x => x.length > 2))];

function response(data, status=200){
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'}});
}

async function loadKnowledge(){
  // База может быть единым knowledge.json в корне или в /knowledge.
  for (const p of ['../../knowledge/knowledge.json','../../../knowledge/knowledge.json']) {
    try {
      const r = await fetch(new URL(p, import.meta.url));
      if(r.ok){ const d = await r.json(); return Array.isArray(d) ? d : (d.items || d.entries || d.knowledge || []); }
    } catch(e){}
  }
  return [];
}

function score(query, item){
  const q = words(query);
  const text = norm([item.title,item.question,item.key,item.planet,item.sign,item.house,item.tags,item.answer,item.content,item.text].filter(Boolean).join(' '));
  if(!q.length || !text) return 0;
  let hit=0; for(const w of q) if(text.includes(w)) hit++;
  let s=hit/q.length;
  const nq=norm(query);
  if(nq.length>5 && text.includes(nq)) s+=3;
  if(item.planet && nq.includes(norm(item.planet))) s+=.4;
  if(item.sign && nq.includes(norm(item.sign))) s+=.4;
  const hm=nq.match(/(?:дом|house)\s*(\d{1,2})/);
  if(hm && Number(item.house)===Number(hm[1])) s+=.5;
  return s;
}

function search(query, db){
  return db.map(item=>({item,s:score(query,item)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,5);
}

function fill(text, profile){
  return String(text ?? '').replace(/\{([a-zA-Z0-9_]+)\}/g,(_,k)=>profile[k] ?? `{${k}}`);
}

function extractProfile(message, old={}){
  const p={...old};
  const n=norm(message);
  const name=message.match(/(?:имя|меня зовут)\s*[:\-]?\s*([А-ЯЁA-Z][А-ЯЁA-Zа-яёa-z-]{1,30})/i);
  if(name)p.user_name=name[1];
  for(const sign of SIGNS) if(n.includes(norm(sign)) && !p.sun_sign) p.sun_sign=sign;
  return p;
}

export default async function handler(req){
  if(req.method==='OPTIONS') return response({},204);
  if(req.method==='GET'){
    const db=await loadKnowledge();
    return response({ok:true,ai:false,service:'ANN knowledge base',knowledgeItems:db.length});
  }
  if(req.method!=='POST') return response({ok:false,error:'Method not allowed'},405);
  try{
    const body=await req.json();
    const message=String(body.message ?? body.text ?? body.query ?? '').trim();
    if(!message) return response({ok:false,error:'Пустое сообщение'},400);
    const profile=extractProfile(message,body.profile||{});
    const db=await loadKnowledge();
    const matches=search(message,db);
    let reply='Я пока работаю без ИИ и могу выдавать только готовые трактовки из базы знаний. Напиши конкретнее, например: «Луна в Тельце», «Солнце в 7 доме» или «Венера в Скорпионе».';
    if(matches[0]){
      const x=matches[0].item;
      const text=x.answer ?? x.content ?? x.text ?? x.description ?? x.value;
      if(text) reply=fill(text,profile);
    }
    return response({ok:true,ai:false,reply,profile,matches:matches.map(x=>({title:x.item.title||x.item.question||x.item.key||'',score:Number(x.s.toFixed(3))}))});
  }catch(e){
    console.error(e);
    return response({ok:false,ai:false,error:'Ошибка обработки запроса'},500);
  }
}
