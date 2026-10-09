import { ethers } from 'ethers';
import { AppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';

const PROJECT_ID = 'f018499b1e4a94d961ab67aeeeff3254';

const botTestnet = {
  id: 968, name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: { default: { name: 'BOTScan Testnet', url: 'https://scan.bohr.life' } },
  testnet: true,
};
const botMainnet = {
  id: 677, name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
  blockExplorers: { default: { name: 'BOTScan', url: 'https://scan.botchain.ai' } },
};

const BN_ABI = [
  'function feeToken() view returns (address)',
  'function ANNUAL_FEE() view returns (uint256)',
  'function register(string label)',
  'function renew(string label)',
  'function transferName(string label,address to)',
  'function setPrimary(string label)',
  'function resolve(string label) view returns (address,uint256)',
  'function isAvailable(string label) view returns (bool)',
  'event NameRegistered(string label,address indexed owner,uint256 fee,uint256 expires)',
];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];

const CONTRACTS = {
  968: {
    bn: '0x2d41cdfbaC769696f5c2cA1630a293c28B2BEC2E',
    twbot: '0xD8FBaBf44B2dbb427d881F8Ea66F14D8287A55c0',
  },
  677: {
    bn: '0x2a5E0eBDb19dE0A360edB101436c6B6f3A7f1dc7',
    twbot: '0xD5452816194a3784dBa983426cCe7c122F4abd30',
  },
};

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 18) => Number(ethers.formatUnits(n, d)).toLocaleString(undefined, { maximumFractionDigits: 4 });
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);
const dateStr = (ts) => (ts > 0n ? new Date(Number(ts) * 1000).toISOString().slice(0, 10) : '—');

let appkit = null;
let readProvider;
let currentChainId = 677;
let account = null;

function initAppKit() {
  if (!$('connectBtn')) return;
  appkit = new AppKit({
    networks: [botTestnet, botMainnet],
    adapters: [new EthersAdapter()],
    projectId: PROJECT_ID,
    themeMode: 'dark',
    metadata: { name: 'BotNames', description: 'Name service on BOT Chain', url: location.origin, icons: [] },
  });
  appkit.subscribeAccount((state) => {
    account = state.address || null;
    $('connectBtn').textContent = account ? short(account) : 'Connect wallet';
    refresh();
  });
  $('connectBtn').addEventListener('click', () => appkit.open());
  $('netSel')?.addEventListener('change', (e) => { currentChainId = Number(e.target.value); refresh(); });
}

function readBN() {
  const c = CONTRACTS[currentChainId];
  if (!c) return null;
  return new ethers.Contract(c.bn, BN_ABI, readProvider);
}

function showMsg(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
}

async function registeredLabels() {
  const c = CONTRACTS[currentChainId];
  if (!c) return [];
  const iface = new ethers.Interface(BN_ABI);
  const topic = iface.getEvent('NameRegistered').topicHash;
  const logs = await readProvider.getLogs({ address: c.bn, topics: [topic], fromBlock: 0, toBlock: 'latest' });
  const labels = [];
  for (const l of logs) {
    try { labels.push(iface.decodeEventLog('NameRegistered', l.data, l.topics).label); } catch {}
  }
  return [...new Set(labels)];
}

async function refresh() {
  const bn = readBN();
  if (!bn) {
    ['tCount', 'tBal'].forEach((id) => { const e = $(id); if (e) e.textContent = 'not on this chain'; });
    return;
  }
  try {
    const labels = await registeredLabels();
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('tCount', String(labels.length));
    if (account) {
      const bal = await new ethers.Contract(CONTRACTS[currentChainId].twbot, ERC20_ABI, readProvider).balanceOf(account);
      set('tBal', fmt(bal) + ' TW');
    } else set('tBal', 'connect wallet');
    const resolved = await Promise.all(labels.map((l) => bn.resolve(l).catch(() => [ethers.ZeroAddress, 0n])));
    const list = $('nameList');
    if (list) {
      if (!labels.length) list.innerHTML = '<div class="hint">No names registered yet — claim the first one.</div>';
      else list.innerHTML = labels.map((l, i) => {
        const [owner, exp] = resolved[i];
        const mine = account && owner.toLowerCase() === account.toLowerCase();
        return `<div class="name-row"><span><b>${l}.bot</b> → <span class="mono" style="font-size:12.5px;color:var(--muted)">${short(owner)}</span></span>
        <span style="display:flex;gap:8px;align-items:center"><span style="font-size:11.5px;color:var(--muted)">exp ${dateStr(exp)}</span>
        <span class="tag ${mine ? 'you' : 'other'}">${mine ? 'yours' : 'owned'}</span></span></div>`;
      }).join('');
    }
    runSearch();
  } catch (e) {
    console.error(e);
    const list = $('nameList');
    if (list) list.innerHTML = '<div class="hint">Failed to load registry: ' + String(e.message || e).slice(0, 120) + '</div>';
  }
}

async function runSearch() {
  const out = $('sOut');
  const label = ($('sInput')?.value || '').trim().toLowerCase();
  if (!out || !label) { if (out) out.style.display = 'none'; return; }
  const bn = readBN();
  if (!bn) return;
  out.style.display = 'block';
  try {
    const [avail, owner, exp] = await Promise.all([bn.isAvailable(label), bn.resolve(label), bn.resolve(label).then((r) => r[1]).catch(() => 0n)]);
    if (avail && owner === ethers.ZeroAddress) {
      out.innerHTML = `<b>${label}.bot</b> — AVAILABLE ✓ · register now for 0.1 WBOT/year`;
    } else if (avail) {
      out.innerHTML = `<b>${label}.bot</b> — AVAILABLE ✓ (previous registration expired ${dateStr(exp)})`;
    } else {
      out.innerHTML = `<b>${label}.bot</b> — TAKEN · owner <span class="mono">${short(owner)}</span> · expires ${dateStr(exp)}`;
    }
  } catch (e) {
    out.innerHTML = 'lookup failed: ' + String(e.message || e).slice(0, 100);
  }
}

async function signerOrAlert() {
  if (!account) { appkit?.open(); return null; }
  if (!CONTRACTS[currentChainId]) { alert('No contracts on this network in this app. Switch to BOT Chain 677 or Testnet 968.'); return null; }
  const s = await appkit?.getSigner();
  if (!s) { appkit?.open(); return null; }
  return s;
}

async function ensureAllowance(amount) {
  const s = await signerOrAlert();
  if (!s) return false;
  const c = CONTRACTS[currentChainId];
  const token = new ethers.Contract(c.twbot, ERC20_ABI, s);
  const owner = await s.getAddress();
  const allow = await token.allowance(owner, c.bn);
  if (allow >= amount) return true;
  const tx = await token.approve(c.bn, amount);
  await tx.wait();
  return true;
}

function cleanLabel(v) {
  return (v || '').trim().toLowerCase().replace(/\.bot$/, '');
}

async function doRegister() {
  const s = await signerOrAlert();
  if (!s) return;
  const c = CONTRACTS[currentChainId];
  const label = cleanLabel($('rLabel')?.value);
  if (label.length < 3 || label.length > 32) return showMsg('rMsg', 'Label must be 3–32 chars');
  if (!/^[a-z0-9-]+$/.test(label) || label.startsWith('-') || label.endsWith('-')) return showMsg('rMsg', 'Only a-z 0-9 -, no leading/trailing dash');
  const bn = readBN();
  const avail = await bn.isAvailable(label);
  if (!avail) return showMsg('rMsg', `${label}.bot is taken`);
  const fee = await bn.ANNUAL_FEE();
  if (!(await ensureAllowance(fee))) return;
  const bnW = new ethers.Contract(c.bn, BN_ABI, s);
  showMsg('rMsg', 'Sending register…');
  try {
    const tx = await bnW.register(label);
    showMsg('rMsg', 'Sent: ' + tx.hash.slice(0, 14) + '…');
    await tx.wait();
    showMsg('rMsg', `${label}.bot registered ✓`);
    refresh();
  } catch (e) { showMsg('rMsg', 'Failed: ' + (e.shortMessage || e.message || '').slice(0, 140)); }
}

async function manageAction(action) {
  const s = await signerOrAlert();
  if (!s) return;
  const c = CONTRACTS[currentChainId];
  const label = cleanLabel($('mLabel')?.value);
  if (!label) return showMsg('mMsg', 'Enter a label');
  const bnW = new ethers.Contract(c.bn, BN_ABI, s);
  try {
    if (action === 'renew') {
      const fee = await bnW.ANNUAL_FEE();
      if (!(await ensureAllowance(fee))) return;
      showMsg('mMsg', 'Sending renew…');
      const tx = await bnW.renew(label);
      await tx.wait();
      showMsg('mMsg', `${label}.bot renewed ✓ (+1 year)`);
    } else if (action === 'transfer') {
      const to = ($('mTo')?.value || '').trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return showMsg('mMsg', 'Enter a valid 0x address in "Transfer to"');
      showMsg('mMsg', 'Sending transfer…');
      const tx = await bnW.transferName(label, ethers.getAddress(to));
      await tx.wait();
      showMsg('mMsg', `${label}.bot transferred ✓`);
    } else if (action === 'primary') {
      showMsg('mMsg', 'Sending setPrimary…');
      const tx = await bnW.setPrimary(label);
      await tx.wait();
      showMsg('mMsg', `Primary name set to ${label}.bot ✓`);
    }
    refresh();
  } catch (e) { showMsg('mMsg', 'Failed: ' + (e.shortMessage || e.message || '').slice(0, 140)); }
}

function boot() {
  readProvider = new ethers.JsonRpcProvider(currentChainId === 677 ? 'https://rpc.botchain.ai' : 'https://rpc.bohr.life');
  initAppKit();
  $('sBtn')?.addEventListener('click', runSearch);
  $('sInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
  $('rBtn')?.addEventListener('click', doRegister);
  $('mRenew')?.addEventListener('click', () => manageAction('renew'));
  $('mTransfer')?.addEventListener('click', () => manageAction('transfer'));
  $('mPrimary')?.addEventListener('click', () => manageAction('primary'));
  refresh();
  setInterval(refresh, 30000);
}
boot();
