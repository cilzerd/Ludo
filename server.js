'use strict';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));

const COLORS = ['Red', 'Green', 'Yellow', 'Blue'];
const START = [0, 13, 26, 39];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const rooms = new Map();
const publicQueue = [];
const makeCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const freshPlayer = (id, name, seat) => ({ id, name, seat, tokens: [{state:'home',step:0},{state:'home',step:0}], connected:true });
function publicState(room) {
  return { code: room.code, mode: room.mode, status: room.status, players: room.players.map(p => ({id:p.id,name:p.name,seat:p.seat,connected:p.connected,tokens:p.tokens})), current:room.current, roll:room.roll, valid:room.valid, message:room.message, winner:room.winner };
}
function broadcast(room) { io.to(room.code).emit('state', publicState(room)); }
function makeRoom(mode) { const code = makeCode(); const room = {code,mode,status:'waiting',players:[],current:0,roll:null,valid:[],message:'Waiting for players…',winner:null}; rooms.set(code,room); return room; }
function findRoomBySocket(id) { for (const room of rooms.values()) { const p=room.players.find(x=>x.id===id); if(p) return {room,player:p}; } return null; }
function pos(seat, token) { if(token.state==='home') return null; if(token.state==='finish') return {r:[7,7,7,7][seat],c:[6,6,8,8][seat]}; if(token.step>=51) return HOME[seat][token.step-51]; return TRACK[(START[seat]+token.step)%52]; }
const TRACK = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]].map(([r,c])=>({r,c}));
const HOME = [ [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]], [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]], [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]], [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]] ].map(a=>a.map(([r,c])=>({r,c})));
function isValid(t, roll) { return t.state!=='finish' && (t.state==='home' || t.step+roll<=56); }
function validMoves(p, roll) { return p.tokens.map((t,i)=>isValid(t,roll)?i:-1).filter(i=>i>=0); }
function nextTurn(room, extra=false) { room.roll=null; room.valid=[]; if(!extra) room.current=(room.current+1)%room.players.length; room.message=`${room.players[room.current].name}'s turn`; }
function finishMove(room, p, tokenIndex) {
  const t=p.tokens[tokenIndex];
  const rolled=room.roll;
  if(t.state==='home') { t.state='track'; t.step=rolled-1; }
  else t.step += rolled;
  if(t.step===56) t.state='finish';
  let captured=false;
  if(t.state==='track') {
    const at=pos(p.seat,t);
    if(!SAFE.has((START[p.seat]+t.step)%52)) {
      for(const other of room.players) if(other!==p) for(const ot of other.tokens) {
        if(ot.state==='track') { const op=pos(other.seat,ot); if(op.r===at.r && op.c===at.c) { ot.state='home'; ot.step=0; captured=true; } }
      }
    }
  }
  const won=p.tokens.every(x=>x.state==='finish');
  const six=rolled===6;
  room.roll=null; room.valid=[];
  if(won) { room.status='finished'; room.winner=p.name; room.message=`${p.name} wins!`; }
  else if(six||captured) room.message=`${p.name} gets an extra roll`;
  else nextTurn(room);
  broadcast(room);
}
function start(room) { if(room.players.length<2) return false; room.status='playing'; room.current=0; room.message=`${room.players[0].name}'s turn`; broadcast(room); return true; }
function removeFromQueue(id) { const i=publicQueue.indexOf(id); if(i>=0) publicQueue.splice(i,1); }

io.on('connection', socket => {
  socket.on('createRoom', ({name}, cb) => {
    const room=makeRoom('private'); const player=freshPlayer(socket.id,String(name||'Guest').trim().slice(0,18)||'Guest',0); room.players.push(player); socket.join(room.code); cb?.({ok:true,code:room.code}); broadcast(room);
  });
  socket.on('joinRoom', ({code,name}, cb) => {
    code=String(code||'').trim().toUpperCase(); const room=rooms.get(code);
    if(!room || room.mode!=='private') return cb?.({ok:false,error:'Room not found. Check the invite code.'});
    if(room.status!=='waiting' || room.players.length>=4) return cb?.({ok:false,error:'This room has already started or is full.'});
    if(room.players.some(p=>p.name.toLowerCase()==String(name||'Guest').trim().toLowerCase())) return cb?.({ok:false,error:'That guest name is already being used in this room.'});
    const player=freshPlayer(socket.id,String(name||'Guest').trim().slice(0,18)||'Guest',room.players.length); room.players.push(player); socket.join(code); cb?.({ok:true,code}); broadcast(room);
  });
  socket.on('publicMatch', ({name}, cb) => {
    const player=freshPlayer(socket.id,String(name||'Guest').trim().slice(0,18)||'Guest',0);
    let room=publicQueue.map(code=>rooms.get(code)).find(r=>r&&r.status==='waiting'&&r.players.length<4);
    if(!room) { room=makeRoom('public'); publicQueue.push(room.code); }
    player.seat=room.players.length; room.players.push(player); socket.join(room.code); cb?.({ok:true,code:room.code});
    if(room.players.length===4) { removeFromQueue(room.code); start(room); } else { room.message=`Waiting for players (${room.players.length}/4)`; broadcast(room); }
  });
  socket.on('startGame', cb => { const found=findRoomBySocket(socket.id); if(!found) return cb?.({ok:false,error:'Join a room first.'}); const {room,player}=found; if(room.mode!=='private'||player.seat!==0) return cb?.({ok:false,error:'Only the room creator can start this private game.'}); if(!start(room)) return cb?.({ok:false,error:'At least 2 players are required.'}); cb?.({ok:true}); });
  socket.on('roll', cb => { const f=findRoomBySocket(socket.id); if(!f) return cb?.({ok:false,error:'You are not in a room.'}); const {room,player}=f; if(room.status!=='playing'||room.players[room.current]!==player||room.roll!==null) return cb?.({ok:false,error:'It is not your turn or the dice has already been rolled.'}); room.roll=crypto.randomInt(1,7); room.valid=validMoves(player,room.roll); room.message=`${player.name} rolled ${room.roll}`; if(!room.valid.length) { room.message+=' — no valid move'; const six=room.roll===6; room.roll=null; if(!six) room.current=(room.current+1)%room.players.length; room.message+=six?'; roll again':`; ${room.players[room.current].name}'s turn`; } broadcast(room); cb?.({ok:true,roll:room.roll}); });
  socket.on('move', ({token}, cb) => { const f=findRoomBySocket(socket.id); if(!f) return cb?.({ok:false,error:'You are not in a room.'}); const {room,player}=f; if(room.status!=='playing'||room.players[room.current]!==player||room.roll===null||!room.valid.includes(Number(token))) return cb?.({ok:false,error:'That move is not valid.'}); finishMove(room,player,Number(token)); cb?.({ok:true}); });
  socket.on('disconnect', () => { removeFromQueue(socket.id); const f=findRoomBySocket(socket.id); if(!f) return; f.player.connected=false; f.room.message=`${f.player.name} disconnected`; broadcast(f.room); setTimeout(()=>{const p=f.room.players.find(x=>x.id===socket.id); if(p&&!p.connected&&f.room.status==='waiting'){f.room.players=f.room.players.filter(x=>x!==p); f.room.players.forEach((x,i)=>x.seat=i); if(!f.room.players.length) rooms.delete(f.room.code); else broadcast(f.room);}},120000); });
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Online Ludo running on port ${PORT}`));
