const socket=io();
const $=id=>document.getElementById(id);
const COLORS=['red','green','yellow','blue'];
const TRACK=[[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
const START=[0,13,26,39];
const HOME=[[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]];
const BASE=[[[2,2],[3,3]],[[2,11],[3,12]],[[11,11],[12,12]],[[11,2],[12,3]]];
const SAFE=[[6,1],[2,6],[1,8],[6,12],[8,13],[12,8],[13,6],[8,2]];
let state=null,roomCode=null;
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2600)}
function name(){return $('guestName').value.trim().slice(0,18)||'Guest'}
function showGame(code){roomCode=code;$('lobby').classList.add('hidden');$('game').classList.remove('hidden');$('codeDisplay').textContent=code;}
function enter(event,payload){socket.emit(event,payload,res=>{if(!res?.ok)return toast(res?.error||'Could not join.');showGame(res.code);});}
$('create').onclick=()=>enter('createRoom',{name:name()});
$('join').onclick=()=>enter('joinRoom',{name:name(),code:$('roomCode').value});
$('match').onclick=()=>enter('publicMatch',{name:name()});
$('start').onclick=()=>socket.emit('startGame',r=>{if(!r?.ok)toast(r?.error||'Could not start');});
$('roll').onclick=()=>socket.emit('roll',r=>{if(!r?.ok)toast(r?.error||'Cannot roll now');});
$('leave').onclick=()=>{location.reload()};
$('copy').onclick=async()=>{const link=location.origin+'/?room='+roomCode;try{await navigator.clipboard.writeText(`Join my Ludo room ${roomCode}: ${link}`);toast('Invite copied');}catch{toast('Room code: '+roomCode)}};
function cell(r,c){return $('board').children[r*15+c]}
function makeBoard(){const b=$('board');b.innerHTML='';for(let r=0;r<15;r++)for(let c=0;c<15;c++){const el=document.createElement('div');el.className='cell';el.dataset.r=r;el.dataset.c=c;
 if(r<6&&c<6)el.classList.add('redhome');else if(r<6&&c>8)el.classList.add('greenhome');else if(r>8&&c>8)el.classList.add('yellowhome');else if(r>8&&c<6)el.classList.add('bluehome');
 if(TRACK.some(([rr,cc])=>rr===r&&cc===c))el.classList.add('track');
 if(HOME[0].some(([rr,cc])=>rr===r&&cc===c))el.classList.add('redlane');if(HOME[1].some(([rr,cc])=>rr===r&&cc===c))el.classList.add('greenlane');if(HOME[2].some(([rr,cc])=>rr===r&&cc===c))el.classList.add('yellowlane');if(HOME[3].some(([rr,cc])=>rr===r&&cc===c))el.classList.add('bluelane');
 if(SAFE.some(([rr,cc])=>rr===r&&cc===c))el.classList.add('safe');if(r>=6&&r<=8&&c>=6&&c<=8)el.classList.add('center');b.appendChild(el);}}
function tokenPos(seat,t,id){if(t.state==='home')return BASE[seat][id];if(t.state==='finish')return HOME[seat][5];if(t.step>=51)return HOME[seat][t.step-51];return TRACK[(START[seat]+t.step)%52];}
function draw(){if(!state)return;for(const el of $('board').children)el.innerHTML='';state.players.forEach(p=>p.tokens.forEach((t,i)=>{const [r,c]=tokenPos(p.seat,t,i);const el=document.createElement('button');el.className=`token ${COLORS[p.seat]}`;el.title=`${p.name}, token ${i+1}`;el.setAttribute('aria-label',el.title);const isTurn=state.players[state.current]?.id===socket.id;
 if(state.status==='playing'&&state.roll!==null&&isTurn&&state.valid?.includes(i))el.classList.add('selectable');else el.disabled=true;
 el.onclick=()=>socket.emit('move',{token:i},res=>{if(!res?.ok)toast(res?.error||'Move rejected');});cell(r,c).appendChild(el);}));
 $('players').innerHTML='';state.players.forEach((p,i)=>{const row=document.createElement('div');row.className='player'+(i===state.current?' current':'');row.innerHTML=`<span class="dot" style="background:var(--${COLORS[p.seat]})"></span><span>${escapeHtml(p.name)}</span><small>${p.tokens.filter(t=>t.state==='finish').length}/2 home</small>`;$('players').appendChild(row);});
 $('status').textContent=state.message;$('hint').textContent=state.status==='waiting'?`Players joined: ${state.players.length}/4`:state.status==='finished'?`${state.winner} won the game`:state.roll===null?'Roll the dice on your turn':`Rolled ${state.roll}. Select a highlighted token.`;
 $('dice').textContent=state.roll??'🎲';$('roll').disabled=state.status!=='playing'||state.roll!==null||state.players[state.current]?.id!==socket.id;
 $('start').classList.toggle('hidden',!(state.mode==='private'&&state.status==='waiting'&&state.players[0]?.id===socket.id));$('start').disabled=state.players.length<2;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
socket.on('state',s=>{state=s;draw();});
socket.on('connect',()=>{document.querySelector('.online').innerHTML='<i></i> Server connected';});socket.on('disconnect',()=>{document.querySelector('.online').textContent='Reconnecting…';});
makeBoard();const invite=new URLSearchParams(location.search).get('room');if(invite)$('roomCode').value=invite.toUpperCase();
