const chat=document.getElementById("chat");
const input=document.getElementById("msg");
const button=document.getElementById("send");
function addMessage(text,type){const el=document.createElement("div");el.className="m "+type;el.textContent=text;chat.appendChild(el);chat.scrollTop=chat.scrollHeight}
addMessage("Привет! Я ANN. Напиши своё имя.","a");
async function sendMessage(){
 const message=input.value.trim(); if(!message)return;
 addMessage(message,"u"); input.value=""; button.disabled=true;
 try{
  const r=await fetch("/.netlify/functions/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,paid:false})});
  const data=await r.json(); addMessage(data.reply||"ANN не вернула ответ.","a");
 }catch(e){addMessage("Ошибка соединения: "+e.message,"a")}
 finally{button.disabled=false;input.focus()}
}
button.addEventListener("click",sendMessage);
input.addEventListener("keydown",e=>{if(e.key==="Enter")sendMessage()});
