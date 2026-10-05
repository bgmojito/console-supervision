// Coquille de la console : horloge, vue rapport (anti-boss) et touche Échap.
// Code repris de sources/aim-trainer.html ; la partie propre aux exercices de toggleBoss passe par onBoss().
import { $, pad } from '../lib/util.js';

/* ---------- Clock & fake view ---------- */
function tick(){ const d=new Date(); $('clock').textContent=`Actualisé à ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
tick(); setInterval(tick,20000);
(function fake(){
  const rows=[['SRV-AD01','Contrôleur de domaine','Production',100],['SRV-AD02','Contrôleur de domaine','Production',100],
    ['SRV-FS02','Serveur de fichiers','Production',98],['SRV-SQL01','Base de données','Production',99],['SRV-WEB01','Frontal web','Production',100],
    ['SRV-WEB02','Frontal web','Préproduction',97],['SRV-APP03','Applicatif','Production',99],['SRV-RDS02','Bureau à distance','Production',96],
    ['SRV-BCK01','Sauvegarde','Production',100],['SRV-PRT01','Impression','Production',94],['SRV-MON01','Supervision','Production',100],['SRV-DHCP01','DHCP / DNS','Production',100]];
  const now=new Date();
  $('fakeRows').innerHTML=rows.map(([h,r,e,c],i)=>{
    const st=c===100?['Conforme','p-ok']:c>=97?['En attente','p-warn']:['À traiter','p-crit'];
    const d=new Date(now-((i*37+12)%180)*60000);
    return `<tr><td class="m">${h}</td><td>${r}</td><td>${e}</td><td><span class="pill ${st[1]}">${st[0]}</span></td><td><span class="bar"><i style="width:${c}%"></i></span>${c} %</td><td class="m">${pad(d.getHours())}:${pad(d.getMinutes())}</td></tr>`;
  }).join('');
})();

/* ---------- Boss key ---------- */
// Accroches des exercices : before(toFake) s'exécute avant l'échange des vues, after(toFake) après,
// dans l'ordre d'enregistrement (même séquence que la fonction d'origine).
const bossHooks=[];
function onBoss(h){ bossHooks.push(h); }
let lastBoss=0;
function toggleBoss(force){
  const toFake = force!==undefined ? force : $('viewFake').hidden;
  lastBoss=performance.now();
  for(const h of bossHooks) if(h.before) h.before(toFake);
  $('viewFake').hidden=!toFake; $('viewGame').hidden=toFake;
  $('crumb').textContent=toFake?'Rapports › Conformité':'Alertes en temps réel';
  $('boss').textContent=toFake?'Temps réel':'Vue rapport';
  for(const h of bossHooks) if(h.after) h.after(toFake);
}
$('boss').onclick=()=>{ toggleBoss(); $('boss').blur(); };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); if(performance.now()-lastBoss<400) return; toggleBoss(); } });

export { toggleBoss, onBoss };
