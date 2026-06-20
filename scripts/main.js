// Extracted JS from index.html. Minor adjustments to ensure functions are exported to global where needed.

// SCROLL REVEAL
(function(){
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-scale');
  if(!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin:'0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
})();

// ACTIVE NAV HIGHLIGHT
(function(){
  const sections = ['packages','about','faq','terms','book'];
  const links = document.querySelectorAll('.nav-link');
  function onScroll(){
    let current='';
    sections.forEach(id=>{
      const el=document.getElementById(id);
      if(el && window.scrollY >= el.offsetTop - 100) current=id;
    });
    links.forEach(l=>{
      l.style.color = l.getAttribute('href')==='#'+current ? 'var(--gold)' : '';
    });
  }
  window.addEventListener('scroll', onScroll, {passive:true});
})();

// HERO PARALLAX
(function(){
  const bg = document.querySelector('.hero-bg');
  if(!bg || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  window.addEventListener('scroll', ()=>{
    const y = window.scrollY;
    if(y < window.innerHeight) bg.style.transform = 'scale(1.05) translateY('+(y*0.10)+'px)';
  }, {passive:true});
})();

// COUNTER ANIMATION
(function(){
  const stats = document.querySelectorAll('.stat-num');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      const el = e.target;
      const raw = el.textContent.trim();
      const num = parseFloat(raw);
      if(isNaN(num)) return;
      const suffix = raw.replace(String(num),'');
      let start = 0;
      const step = (timestamp) => {
        if(!start) start = timestamp;
        const p = Math.min((timestamp-start)/1200,1);
        const ease = 1-Math.pow(1-p,3);
        el.textContent = Math.round(ease*num) + suffix;
        if(p<1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      io.unobserve(el);
    });
  },{threshold:0.8});
  stats.forEach(s=>io.observe(s));
})();

// FAQ ACCORDION
(function(){
  document.querySelectorAll('.faq-item').forEach(item=>{
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    if(!q || !a) return;
    a.style.overflow = 'hidden';
    a.style.transition = 'max-height 0.35s ease, opacity 0.3s ease, padding 0.3s ease';
    a.style.maxHeight = a.scrollHeight+'px';
    a.style.opacity = '1';
    q.style.cursor = 'pointer';
    q.style.userSelect = 'none';
    q.style.display = 'flex';
    q.style.justifyContent = 'space-between';
    q.style.alignItems = 'center';
    const chev = document.createElement('span');
    chev.textContent = '▲';
    chev.style.cssText='font-size:9px;color:var(--gold);transition:transform 0.3s ease;margin-left:12px;flex-shrink:0';
    q.appendChild(chev);
    let open = true;
    q.addEventListener('click', ()=>{
      open = !open;
      a.style.maxHeight  = open ? a.scrollHeight+'px' : '0px';
      a.style.opacity    = open ? '1' : '0';
      a.style.paddingTop = open ? '' : '0';
      chev.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    });
  });
})();

// PAYMENT SYSTEM
const WALLET            = '0x042b01de3dcab66f3465f1d4e1cebbf00f618d2f';
const WALLET_LC         = WALLET.toLowerCase();
const AMOUNT_TOLERANCE  = 0.005;
const POLL_INTERVAL_MS  = 8000;
const MAX_POLL_ATTEMPTS = 75;
const SESSION_START_BUFFER_MS = 30000;
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xjgdaojz';

const usedTxHashes = new Set(JSON.parse(sessionStorage.getItem('wc_used_txs') || '[]'));
function markTxUsed(h) { usedTxHashes.add(h.toLowerCase()); sessionStorage.setItem('wc_used_txs', JSON.stringify([...usedTxHashes])); }
function isTxUsed(h) { return usedTxHashes.has((h||'').toLowerCase()); }

let ethPrice = null;
let selPkg = { id:'15sec', name:'Kickoff Spot', usd:2500 };
let paymentTxHash = null;
let bookingRef = null;
let watcherInterval = null;
let watcherSessionStart = null;
let seenHashes = new Set();
let wrongAmountCount = 0;

const MATCH_DAYS = [
  {date:'2026-06-20',matches:'Morocco vs Portugal'},
  {date:'2026-06-21',matches:'England vs Nigeria'},
  {date:'2026-06-22',matches:'USA vs Australia'},
  {date:'2026-06-23',matches:'Brazil vs Scotland'},
  {date:'2026-06-24',matches:'Germany vs Ecuador'},
  {date:'2026-06-25',matches:'Spain vs Costa Rica'},
  {date:'2026-06-26',matches:'Argentina vs Chile'},
  {date:'2026-06-27',matches:'Round of 32 begins'},
  {date:'2026-07-10',matches:'Quarterfinals'},
  {date:'2026-07-14',matches:'Semifinals'},
  {date:'2026-07-18',matches:'Third Place Play-off'},
  {date:'2026-07-19',matches:'Final — MetLife Stadium, NJ'},
];

async function fetchEthPrice() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const d = await r.json();
    ethPrice = d.ethereum.usd;
    updateAllEthDisplays();
    const now = new Date();
    ['tickerTime','heroEthTime'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.textContent = 'Updated ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    });
  } catch(e) {
    ['tickerEthVal','heroEthPrice'].forEach(id => {
      const el = document.getElementById(id); if(el) el.textContent='Unavailable';
    });
  }
}
function toEth(usd) { return ethPrice ? (usd/ethPrice).toFixed(6) : null; }
function fmtEth(usd) { const e=toEth(usd); return e ? e+' ETH' : '—'; }
function toWei(eth) { return Math.round(parseFloat(eth)*1e18); }

function updateAllEthDisplays() {
  if(!ethPrice) return;
  const ps='$'+ethPrice.toLocaleString();
  ['tickerEthVal','heroEthPrice'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=ps;});
  [['15',2500],['30',5500],['45',8500],['60',12000]].forEach(([s,u])=>{
    const a=document.getElementById('pe-'+s), b=document.getElementById('prev-eth-'+s);
    if(a) a.textContent='≈ '+fmtEth(u);
    if(b) b.textContent='≈ '+fmtEth(u);
  });
}

const pkgData = {
  '15sec':{name:'Kickoff Spot',dur:'15 seconds',usd:2500},
  '30sec':{name:'Champion Cut',dur:'30 seconds',usd:5500},
  '45sec':{name:'Stadium Slot',dur:'45 seconds',usd:8500},
  '60sec':{name:'Trophy Takeover',dur:'60 seconds',usd:12000},
};

function selectPkg(id, name, usd) {
  ['15sec','30sec','45sec','60sec'].forEach(s=>{
    const c=document.getElementById('pkg-'+s), k=document.getElementById('chk-'+s);
    if(c) c.classList.remove('sel'); if(k) k.classList.remove('checked');
  });
  const chosen=document.getElementById('pkg-'+id), chkEl=document.getElementById('chk-'+id);
  if(chosen) chosen.classList.add('sel'); if(chkEl) chkEl.classList.add('checked');
  selPkg={id,name,usd};
  const dur=parseInt(id);
  const badge=document.getElementById('prevDurBadge');
  if(badge) badge.textContent=dur+' SEC AD';
  startPreviewAnimation(dur);
}

let prevTimer=null;
function startPreviewAnimation(seconds) {
  if(prevTimer) clearInterval(prevTimer);
  const bar=document.getElementById('prevBar');
  if(!bar) return;
  bar.style.width='0%';
  let elapsed=0;
  prevTimer=setInterval(()=>{
    elapsed+=50;
    bar.style.width=Math.min((elapsed/(seconds*1000))*100,100)+'%';
    if(elapsed>=seconds*1000){
      clearInterval(prevTimer);
      setTimeout(()=>{bar.style.width='0%';startPreviewAnimation(seconds);},800);
    }
  },50);
}

function goStep(n) {
  if(n===2 && !validateStep1()) return;
  if(n===3 && !validateStep2()) return;
  document.querySelectorAll('.step-panel').forEach(p=>p.classList.remove('active'));
  const target=document.getElementById('panel'+n);
  if(target) target.classList.add('active');
  [1,2,3].forEach(i=>{
    const el=document.getElementById('pi'+i); if(!el) return;
    el.classList.remove('active','done');
    if(i<n) el.classList.add('done');
    if(i===n) el.classList.add('active');
  });
  if(n===3) populateOrderSummary();
  const prog=document.getElementById('progOuter');
  if(prog) prog.scrollIntoView({behavior:'smooth',block:'start'});
}
function validateStep1() { return true; }
function validateStep2() {
  const ids=['ceoName','bizName','bizNature','contactEmail','adDesc','country'];
  let ok=true;
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(!el || !el.value.trim()){if(el){el.classList.add('err');setTimeout(()=>el.classList.remove('err'),2500);}ok=false;}
  });
  if(!ok) alert('Please fill in all required fields.');
  return ok;
}

function populateOrderSummary() {
  const airDate=getAirDate();
  const biz=document.getElementById('bizName');
  const ceo=document.getElementById('ceoName');
  document.getElementById('s-biz').textContent    = biz? biz.value : '';
  document.getElementById('s-ceo').textContent    = ceo? ceo.value : '';
  document.getElementById('s-dur').textContent    = pkgData[selPkg.id].dur;
  document.getElementById('s-pkg').textContent    = selPkg.name;
  document.getElementById('s-airdate').textContent= airDate.airDateStr+' (day after next match)';
  document.getElementById('s-usd').textContent    = '$'+selPkg.usd.toLocaleString();
  document.getElementById('s-eth').textContent    = '≈ '+(toEth(selPkg.usd)||'—')+' ETH';
  const mm=document.getElementById('mm-eth-amount'); if(mm) mm.textContent=(toEth(selPkg.usd)||'—')+' ETH';
  const manEth=document.getElementById('man-eth'); if(manEth) manEth.textContent=(toEth(selPkg.usd)||'—')+' ETH';
  const manUsd=document.getElementById('man-usd'); if(manUsd) manUsd.textContent='≈ $'+selPkg.usd.toLocaleString();
  const wa=document.getElementById('walletAddr'); if(wa) wa.textContent=WALLET;
  setTimeout(drawQR,200);
}

function getAirDate() {
  const today=new Date(); today.setHours(0,0,0,0);
  let nm=null;
  for(const m of MATCH_DAYS){const d=new Date(m.date+'T00:00:00');if(d>=today){nm=m;break;}}
  if(!nm) return{matchDateStr:'Jul 19, 2026 (Final)',airDateStr:'Jul 20, 2026',airDate:new Date('2026-07-20')};
  const md=new Date(nm.date+'T00:00:00');
  const ad=new Date(md); ad.setDate(ad.getDate()+1);
  const opts={month:'short',day:'numeric',year:'numeric'};
  return{matchDateStr:md.toLocaleDateString('en-US',opts)+' — '+nm.matches,matchDate:md,airDate:ad,airDateStr:ad.toLocaleDateString('en-US',opts)};
}

function startCountdown(airDate) {
  function tick(){
    let diff=Math.max(airDate-new Date(),0);
    const d=document.getElementById('cdDays'); if(d) d.textContent =String(Math.floor(diff/86400000)).padStart(2,'0');
    const h=document.getElementById('cdHours'); if(h) h.textContent=String(Math.floor((diff%86400000)/3600000)).padStart(2,'0');
    const m=document.getElementById('cdMins'); if(m) m.textContent =String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    const s=document.getElementById('cdSecs'); if(s) s.textContent =String(Math.floor((diff%60000)/1000)).padStart(2,'0');
  }
  tick(); setInterval(tick,1000);
}

function drawQR() {
  const canvas=document.getElementById('qrCanvas');
  const ea=toEth(selPkg.usd)||'0';
  const uri='ethereum:'+WALLET+'?value='+toWei(ea);
  try{new QRCode(canvas,{text:uri,width:150,height:150,colorDark:'#627EEA',colorLight:'#060F1E'});}catch(e){}
}

function copyAddr() {
  navigator.clipboard.writeText(WALLET).then(()=>{
    const btn=document.querySelector('.copy-btn');
    if(btn){btn.textContent='✓ Copied!';btn.style.color='#4ADE80';setTimeout(()=>{btn.textContent='📋 Copy Address';btn.style.color='';},2200);}  
  });
}

function switchPayTab(tab) {
  const tmm=document.getElementById('tab-mm'); if(tmm) tmm.classList.toggle('active',tab==='metamask');
  const tman=document.getElementById('tab-manual'); if(tman) tman.classList.toggle('active',tab==='send');
  const mm=document.getElementById('mmSection'); if(mm) mm.style.display  =tab==='metamask'?'block':'none';
  const send=document.getElementById('sendSection'); if(send) send.style.display=tab==='send'?'block':'none';
}

function showWatcher(ethAmt) {
  const mm=document.getElementById('mmSection'); if(mm) mm.style.display='none';
  const send=document.getElementById('sendSection'); if(send) send.style.display='none';
  const pt=document.querySelector('.pay-tabs'); if(pt) pt.style.display='none';
  const back=document.getElementById('backBtn'); if(back) back.style.display='none';
  const w=document.getElementById('watcherPanel'); if(w) w.style.display='block';
  const we=document.getElementById('watcherEthAmt'); if(we) we.textContent =ethAmt+' ETH';
  const icon=document.getElementById('watcherIcon'); if(icon) icon.textContent  ='🔍';
  const title=document.getElementById('watcherTitle'); if(title){title.textContent ='WATCHING BLOCKCHAIN'; title.style.color ='var(--eth)';}
  const desc=document.getElementById('watcherDesc'); if(desc) desc.textContent  ='Monitoring your payment on Etherscan every 8 seconds. We\'ll confirm automatically — no manual input needed.';
}

function cancelWatcher() {
  stopWatcher(); wrongAmountCount=0;
  const w=document.getElementById('watcherPanel'); if(w) w.style.display='none';
  const pt=document.querySelector('.pay-tabs'); if(pt) pt.style.display='';
  const back=document.getElementById('backBtn'); if(back) back.style.display='';
  switchPayTab('metamask');
  const btn=document.getElementById('mmPayBtn'); if(btn){btn.disabled=false; btn.innerHTML='Connect Wallet &amp; Pay';}
  setStatus(document.getElementById('mmStatus'),'','');
}

function stopWatcher() {
  if(watcherInterval){clearInterval(watcherInterval);watcherInterval=null;}
}

async function startBlockchainWatcher(ethAmt, onConfirmed) {
  stopWatcher();
  wrongAmountCount=0; watcherSessionStart=Date.now(); seenHashes=new Set();
  try{const snap=await fetchAddressTxs();if(snap)snap.forEach(tx=>seenHashes.add(tx.hash.toLowerCase()));}catch(e){}
  const expectedWei=toWei(ethAmt);
  const minWei=Math.floor(expectedWei*(1-AMOUNT_TOLERANCE));
  const maxWei=Math.ceil(expectedWei*(1+AMOUNT_TOLERANCE));
  let attempts=0;
  const statusEl=document.getElementById('watcherStatus');
  watcherInterval=setInterval(async()=>{
    attempts++;
    const elapsed=Math.floor((Date.now()-watcherSessionStart)/1000);
    const mins=Math.floor(elapsed/60), secs=elapsed%60;
    if(statusEl) statusEl.textContent='Scanning blockchain… '+(mins>0?mins+'m ':'')+secs+'s elapsed';
    let txs;
    try{txs=await fetchAddressTxs();}catch(e){return;}
    if(!txs) return;
    for(const tx of txs){
      const hash=(tx.hash||'').toLowerCase();
      if(seenHashes.has(hash)) continue;
      seenHashes.add(hash);
      if((tx.to||'').toLowerCase()!==WALLET_LC) continue;
      if(tx.isError!=='0'){setWatcherWarning('A failed transaction was detected and ignored.');continue;}
      const vWei=parseInt(tx.value||'0',10);
      if(vWei===0){setWatcherWarning('⛔ Token transfer detected and rejected. Send native ETH only.');continue;}
      const txMs=parseInt(tx.timeStamp||'0',10)*1000;
      if(txMs<watcherSessionStart-SESSION_START_BUFFER_MS){setWatcherWarning('⏰ An old transaction was detected and rejected. Only fresh payments are accepted.');continue;}
      if(isTxUsed(hash)){setWatcherWarning('❌ This transaction has already been used for a previous booking.');continue;}
      if(vWei<minWei){
        wrongAmountCount++;
        const fw=wrongAmountCount>=2?'⚠️ Multiple underpayments detected. Contact support if this is an error.':'⛔ Insufficient payment detected ('+(vWei/1e18).toFixed(6)+' ETH received, '+ethAmt+' ETH required).';
        setWatcherWarning(fw); continue;
      }
      stopWatcher(); markTxUsed(hash);
      const icon=document.getElementById('watcherIcon'); if(icon) icon.textContent ='✅';
      const title=document.getElementById('watcherTitle'); if(title){title.textContent='PAYMENT CONFIRMED!';title.style.color='var(--green-l)';}
      const desc=document.getElementById('watcherDesc'); if(desc) desc.textContent ='Transaction verified on Etherscan. Preparing your booking…';
      if(statusEl) statusEl.textContent='Confirmed · TX: '+hash.slice(0,18)+'…';
      paymentTxHash=tx.hash;
      setTimeout(()=>onConfirmed(tx.hash),1600);
      return;
    }
    if(attempts>=MAX_POLL_ATTEMPTS){
      stopWatcher();
      const icon=document.getElementById('watcherIcon'); if(icon) icon.textContent ='⏰';
      const title=document.getElementById('watcherTitle'); if(title){title.textContent='TIMED OUT';title.style.color='#F08080';}
      const desc=document.getElementById('watcherDesc'); if(desc) desc.textContent ='Auto-detection timed out after 10 minutes. If you sent the ETH, please contact us with your transaction hash at Romygai@outlook.com.';
      if(statusEl) statusEl.textContent='Stopped after 10 minutes.';
    }
  },POLL_INTERVAL_MS);
}

function setWatcherWarning(msg) {
  const el=document.getElementById('watcherWarning');
  if(el){el.textContent=msg;el.style.display='block';setTimeout(()=>{el.style.display='none';},8000);} 
}

async function fetchAddressTxs() {
  const base='https://api.etherscan.io/api?module=account&action=txlist&address='+WALLET+'&startblock=0&endblock=99999999&page=1&offset=25&sort=desc';
  for(const url of[base+'&apikey=PCAAZ6NUKYKF5DBQFEN34Y6IK3UUB1Y9I4',base]){
    try{const r=await fetch(url);const d=await r.json();if(d.status==='1'&&Array.isArray(d.result)) return d.result;}catch(e){}
  }
  return null;
}

async function payWithMetaMask() {
  const btn=document.getElementById('mmPayBtn');
  const statusEl=document.getElementById('mmStatus');
  const ethAmt=toEth(selPkg.usd);
  if(!ethAmt){setStatus(statusEl,'error','ETH price unavailable. Refresh and try again.');return;}
  if(typeof window.ethereum==='undefined'){setStatus(statusEl,'error','No Web3 wallet found. Install MetaMask or use the Send Manually tab.');return;}
  try{
    if(btn){btn.disabled=true; btn.innerHTML='<span class="spin"></span>Connecting wallet…';}
    setStatus(statusEl,'pending','🔗 Connecting to your wallet…');
    const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
    const chainId=await window.ethereum.request({method:'eth_chainId'});
    if(chainId!=='0x1'){
      setStatus(statusEl,'error','⛔ Wrong network (Chain ID: '+parseInt(chainId,16)+'). Switch to Ethereum Mainnet and try again.');
      if(btn){btn.disabled=false; btn.innerHTML='Connect Wallet &amp; Pay';}
      return;
    }
    setStatus(statusEl,'pending','📝 Please confirm the transaction in MetaMask…');
    if(btn) btn.innerHTML='<span class="spin"></span>Waiting for signature…';
    const exactWei=toWei(ethAmt);
    const weiHex='0x'+exactWei.toString(16);
    await window.ethereum.request({method:'eth_sendTransaction',params:[{from:accounts[0],to:WALLET,value:weiHex,chainId:'0x1'}]});
    if(btn) btn.innerHTML='✓ Sent — Detecting on blockchain…';
    showWatcher(ethAmt);
    startBlockchainWatcher(ethAmt,confirmedTx=>showSuccess(confirmedTx));
  }catch(err){
    const msg=err.code===4001?'Transaction cancelled by user.':(err.message||'Transaction failed. Please try again.');
    setStatus(statusEl,'error',msg);
    if(btn){btn.disabled=false; btn.innerHTML='Connect Wallet &amp; Pay';}
  }
}

function startManualWatcher() {
  const ethAmt=toEth(selPkg.usd)||'0';
  const btn=document.getElementById('iSentBtn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>Monitoring blockchain…';}
  showWatcher(ethAmt);
  startBlockchainWatcher(ethAmt,confirmedTx=>showSuccess(confirmedTx));
}

function showSuccess(txHash) {
  stopWatcher();
  const prog=document.getElementById('progOuter'); if(prog) prog.style.display='none';
  const form=document.querySelector('.form-outer'); if(form) form.style.display='none';
  const ref='WC2026-'+Math.floor(10000+Math.random()*90000);
  bookingRef=ref;
  const ceo=document.getElementById('ceoName');
  const email=document.getElementById('contactEmail');
  const succName=document.getElementById('succ-name'); if(succName) succName.textContent  ='Welcome, '+(ceo?ceo.value:'')+'!';
  const succEmail=document.getElementById('succ-email'); if(succEmail) succEmail.textContent = (email?email.value:'');
  const succRef=document.getElementById('succ-ref'); if(succRef) succRef.textContent   =ref;
  if(txHash&&txHash.startsWith('0x')){
    const txEl=document.getElementById('succ-tx'); if(txEl) txEl.textContent =txHash;
    const link=document.getElementById('succ-etherscan'); if(link) {link.href='https://etherscan.io/tx/'+txHash;}
    const txCard=document.getElementById('txCard'); if(txCard) txCard.style.display='block';
  }
  const ai=getAirDate();
  const pd=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const parts=ai.matchDateStr.split(' — ');
  const cdMatch=document.getElementById('cdMatch'); if(cdMatch) cdMatch.textContent  =parts[0]||'Next Match Day';
  const cdVenue=document.getElementById('cdVenue'); if(cdVenue) cdVenue.textContent  =parts[1]||ai.matchDateStr;
  const cdPayDate=document.getElementById('cdPayDate'); if(cdPayDate) cdPayDate.textContent=pd;
  const cdMatchDay=document.getElementById('cdMatchDay'); if(cdMatchDay) cdMatchDay.textContent=parts[0];
  const cdAirDate=document.getElementById('cdAirDate'); if(cdAirDate) cdAirDate.textContent=ai.airDateStr;
  startCountdown(ai.airDate);
  sendBookingNotification(ref,txHash,ai);
  const sp=document.getElementById('successPanel'); if(sp) {sp.classList.add('active'); sp.scrollIntoView({behavior:'smooth'});}  
}

function sendBookingNotification(ref,txHash,airInfo) {
  if(!FORMSPREE_ENDPOINT||FORMSPREE_ENDPOINT.includes('YOUR_FORM_ID')) return;
  const payload={
    _subject:'New WC2026 Ad Booking — '+ref,
    bookingRef:ref,
    ceoName:document.getElementById('ceoName')?document.getElementById('ceoName').value:'',
    businessName:document.getElementById('bizName')?document.getElementById('bizName').value:'',
    industry:document.getElementById('bizNature')?document.getElementById('bizNature').value:'',
    email:document.getElementById('contactEmail')?document.getElementById('contactEmail').value:'',
    phoneCode:document.getElementById('phoneCode')?document.getElementById('phoneCode').value:'',
    phone:document.getElementById('phone')?document.getElementById('phone').value:'',
    adDescription:document.getElementById('adDesc')?document.getElementById('adDesc').value:'',
    country:document.getElementById('country')?document.getElementById('country').value:'',
    package:selPkg.name,
    duration:pkgData[selPkg.id].dur,
    usdAmount:'$'+selPkg.usd.toLocaleString(),
    ethAmount:(toEth(selPkg.usd)||'—')+' ETH',
    txHash:txHash||'n/a',
    etherscanLink:txHash?('https://etherscan.io/tx/'+txHash):'n/a',
    nextAirDate:airInfo.airDateStr,
  };
  fetch(FORMSPREE_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)})
    .then(r=>{if(r.ok)console.log('[WC2026] Booking notification sent.');else console.warn('[WC2026] Notification failed:',r.status);})
    .catch(e=>console.warn('[WC2026] Notification error:',e));
}

function setStatus(el, type, msg) {
  if(!el) return;
  el.className='status-box'+(msg?' show '+type:'');
  el.textContent=msg;
}

fetchEthPrice();
setInterval(fetchEthPrice,60000);
startPreviewAnimation(15);

// WHY-CARD TRANSITIONS
document.querySelectorAll('.why-card').forEach(card => {
  card.style.transition = 'border-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease';
  card.addEventListener('mouseenter', () => {
    card.style.borderColor = 'rgba(232,160,32,0.35)';
    card.style.transform   = 'translateY(-3px)';
    card.style.boxShadow   = '0 10px 32px rgba(0,0,0,0.3)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.borderColor = 'rgba(255,255,255,0.07)';
    card.style.transform   = '';
    card.style.boxShadow   = '';
  });
});

// FLOATING MOBILE CTA
(function(){
  const fab = document.getElementById('floatCTA');
  if(!fab) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const bookEl = document.getElementById('book');
    const successEl = document.getElementById('successPanel');
    const nearBook = bookEl && y + window.innerHeight > bookEl.offsetTop - 100;
    const onSuccess = successEl && successEl.classList.contains('active');
    if(nearBook || onSuccess) {
      fab.style.opacity = '0';
      fab.style.pointerEvents = 'none';
    } else {
      fab.style.opacity = y > 300 ? '1' : '0';
      fab.style.pointerEvents = y > 300 ? 'auto' : 'none';
    }
  }, {passive:true});
})();

// Expose functions used by inline handlers
window.selectPkg = selectPkg;
window.goStep = goStep;
window.copyAddr = copyAddr;
window.switchPayTab = switchPayTab;
window.payWithMetaMask = payWithMetaMask;
window.startManualWatcher = startManualWatcher;
window.cancelWatcher = cancelWatcher;
window.copyAddr = copyAddr;

