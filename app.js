const $=id=>document.getElementById(id);
const money=n=>"৳"+Number(n||0).toLocaleString("en-BD",{maximumFractionDigits:2});
let state={players:[],round:1,history:[],currentBet:0,started:false};
const key="pokerBalanceTracker_v1";

function save(){localStorage.setItem(key,JSON.stringify(state))}
function load(){try{const x=JSON.parse(localStorage.getItem(key));if(x)state=x}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function renderSetup(){
 $("setupPlayers").innerHTML=state.players.map((p,i)=>`<span class="setup-player">${esc(p.name)} <button onclick="removePlayer(${i})">×</button></span>`).join("");
}
function addPlayer(){
 const name=$("playerName").value.trim();
 if(!name)return alert("Enter a player name.");
 if(state.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return alert("Player already exists.");
 const bal=Number($("startingBalance").value)||0;
 state.players.push({id:crypto.randomUUID(),name,balance:bal,startBalance:bal,contribution:0,folded:false,totalWon:0,totalLost:0,wins:0,losses:0});
 $("playerName").value=""; renderSetup(); save();
}
function removePlayer(i){if(state.started)return;state.players.splice(i,1);renderSetup();save()}
function startGame(){
 if(state.players.length<2)return alert("Add at least 2 players.");
 state.started=true;state.round=1;state.currentBet=0;
 state.players.forEach(p=>{p.contribution=0;p.folded=false});
 $("setup").hidden=true;$("game").hidden=false;render();save();
}
function pot(){return state.players.reduce((s,p)=>s+p.contribution,0)}
function active(){return state.players.filter(p=>!p.folded && p.balance+p.contribution>0)}
function render(){
 $("roundNo").textContent=state.round;
 $("pot").textContent=money(pot());
 $("currentBet").textContent=money(state.currentBet);
 $("activeCount").textContent=active().length;
 $("players").innerHTML=state.players.map((p,i)=>{
   const available=p.balance;
   return `<div class="player ${p.folded?"folded":""}">
    <div class="player-top"><span class="player-name">${esc(p.name)}</span><span class="balance">${money(p.balance)}</span></div>
    <div class="betline">Round contribution: <strong>${money(p.contribution)}</strong></div>
    <div class="actions">
      <button onclick="bet(${i},'call')">Call</button>
      <button onclick="bet(${i},'raise')">Raise</button>
      <button onclick="bet(${i},'check')">Check</button>
      <button onclick="fold(${i})">${p.folded?"Folded":"Fold"}</button>
    </div>
    <div class="raise-box">
      <input id="amt-${i}" type="number" min="1" step="1" placeholder="Bet / raise amount">
      <button onclick="customBet(${i})">Bet</button>
    </div>
    <button class="wide" onclick="allIn(${i})" ${p.folded||available<=0?"disabled":""}>All-in (${money(available)})</button>
   </div>`
 }).join("");
 renderSummary();renderHistory();
}
function take(p,amount){
 amount=Math.max(0,Math.floor(Number(amount)||0));
 if(amount>p.balance)amount=p.balance;
 p.balance-=amount;p.contribution+=amount;
 state.currentBet=Math.max(state.currentBet,p.contribution);
}
function bet(i,type){
 const p=state.players[i];if(p.folded||p.balance<=0)return;
 if(type==="check"){if(p.contribution<state.currentBet)return alert("Cannot check below the current bet.");return}
 if(type==="call"){take(p,Math.max(0,state.currentBet-p.contribution));}
 if(type==="raise"){
   const input=prompt(`Total contribution after raise for ${p.name}:`,String(Math.max(state.currentBet*2, state.currentBet+1)));
   if(input===null)return;
   const target=Number(input);
   if(!Number.isFinite(target)||target<=state.currentBet)return alert("Raise must be above the current bet.");
   take(p,target-p.contribution);
 }
 render();save();
}
function customBet(i){
 const p=state.players[i];if(p.folded||p.balance<=0)return;
 const v=Number($(`amt-${i}`).value);if(!v||v<=0)return;
 take(p,v);render();save();
}
function allIn(i){const p=state.players[i];if(p.folded)return;take(p,p.balance);render();save()}
function fold(i){state.players[i].folded=true;render();save()}
function resetRound(){
 if(!confirm("Reset this round? All current bets will be returned to players."))return;
 state.players.forEach(p=>{p.balance+=p.contribution;p.contribution=0;p.folded=false});
 state.currentBet=0;render();save();
}
function finishRound(){
 if(pot()<=0)return alert("There is no money in the pot.");
 if(active().length===0)return alert("At least one active player is required.");
 $("winnerPanel").hidden=false;
 $("winnerList").innerHTML=state.players.filter(p=>!p.folded).map((p,i)=>`<label class="winner"><input type="checkbox" value="${p.id}"> ${esc(p.name)} — ${money(p.balance)}</label>`).join("");
 $("winnerPanel").scrollIntoView({behavior:"smooth"});
}
function confirmWinner(){
 const ids=[...document.querySelectorAll("#winnerList input:checked")].map(x=>x.value);
 if(!ids.length)return alert("Select at least one winner.");
 const total=pot(), winners=state.players.filter(p=>ids.includes(p.id));
 const base=Math.floor(total/winners.length), remainder=total-base*winners.length;
 const payouts={};
 winners.forEach((p,i)=>{const pay=base+(i===0?remainder:0);p.balance+=pay;p.totalWon+=pay;p.wins++;payouts[p.id]=pay});
 state.players.filter(p=>!ids.includes(p.id)).forEach(p=>{p.totalLost+=p.contribution;p.losses++});
 const result=state.players.map(p=>({name:p.name,contribution:p.contribution,payout:payouts[p.id]||0,net:(payouts[p.id]||0)-p.contribution}));
 state.history.unshift({round:state.round,pot:total,winners:winners.map(p=>p.name),result,date:new Date().toLocaleString()});
 state.players.forEach(p=>{p.contribution=0;p.folded=false});
 state.currentBet=0;state.round++;$("winnerPanel").hidden=true;render();save();
}
function renderSummary(){
 $("summaryPlayers").innerHTML=state.players.map(p=>{
   const net=p.balance-p.startBalance;
   return `<div class="summary"><strong>${esc(p.name)}</strong><span>${money(p.balance)}</span><span>${p.wins}W / ${p.losses}L</span><span class="profit ${net>=0?"positive":"negative"}">${net>=0?"+":""}${money(net)}</span></div>`
 }).join("");
}
function renderHistory(){
 $("history").innerHTML=state.history.length?state.history.map(h=>`<div class="history-item"><div class="history-head"><span>Round #${h.round} — ${h.winners.map(esc).join(", ")}</span><span>${money(h.pot)}</span></div><div class="muted">${esc(h.date)}</div><ul>${h.result.map(r=>`<li>${esc(r.name)}: paid ${money(r.contribution)}, received ${money(r.payout)}, net <b class="${r.net>=0?"positive":"negative"}">${r.net>=0?"+":""}${money(r.net)}</b></li>`).join("")}</ul></div>`).join(""):"<p class='muted'>No completed rounds yet.</p>";
}
function newGame(){
 if(!confirm("Start a completely new game?"))return;
 localStorage.removeItem(key);location.reload();
}
$("addPlayerBtn").onclick=addPlayer;$("startGameBtn").onclick=startGame;$("resetRoundBtn").onclick=resetRound;
$("finishRoundBtn").onclick=finishRound;$("confirmWinnerBtn").onclick=confirmWinner;$("newGameBtn").onclick=newGame;
$("clearHistoryBtn").onclick=()=>{if(confirm("Clear all saved round history?")){state.history=[];save();renderHistory()}};
load();renderSetup();
if(state.started){$("setup").hidden=true;$("game").hidden=false;render()}
window.removePlayer=removePlayer;window.bet=bet;window.customBet=customBet;window.allIn=allIn;window.fold=fold;
