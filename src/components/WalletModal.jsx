import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

function saveUser(u) { localStorage.setItem('404x1_user', JSON.stringify(u)); }

function detectWallets() {
  return {
    x1: typeof window.x1Wallet !== 'undefined' && window.x1Wallet !== null,
    phantom: typeof window.phantom !== 'undefined' && typeof window.phantom?.solana !== 'undefined',
    backpack: typeof window.backpack !== 'undefined' && window.backpack !== null,
    metamask: typeof window.ethereum !== 'undefined' && window.ethereum !== null,
  };
}

export default function WalletModal() {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempWalletAddress, setTempWalletAddress] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletConnectError, setWalletConnectError] = useState('');

  useEffect(() => {
    const handler = () => setShowWalletModal(true);
    window.addEventListener('open_wallet_modal', handler);
    return () => window.removeEventListener('open_wallet_modal', handler);
  }, []);

  const connectWallet = async (walletType) => {
    setWalletConnecting(true);
    setWalletConnectError('');
    try {
      let address = null;
      if (walletType === 'x1') {
        if (!window.x1Wallet) { setWalletConnectError('X1 Wallet not installed'); return; }
        const resp = await window.x1Wallet.connect();
        address = resp.publicKey.toString();
      } else if (walletType === 'phantom') {
        if (!window.phantom?.solana) { setWalletConnectError('Phantom not installed'); return; }
        const resp = await window.phantom.solana.connect();
        address = resp.publicKey.toString();
      } else if (walletType === 'backpack') {
        if (!window.backpack) { setWalletConnectError('Backpack not installed'); return; }
        const resp = await window.backpack.connect();
        address = resp.publicKey.toString();
      } else if (walletType === 'metamask') {
        if (!window.ethereum) { setWalletConnectError('MetaMask not installed'); return; }
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        address = accounts[0];
      }
      if (!address) { setWalletConnectError('Wallet connection failed'); return; }

      setTempWalletAddress(address);
      const response = await base44.functions.invoke('authWallet', { wallet_address: address });
      const data = response.data;

      if (data.success && data.user) {
        saveUser(data.user);
        setShowWalletModal(false);
        window.dispatchEvent(new Event('userAuthChanged'));
      } else if (data.needs_username) {
        setShowWalletModal(false);
        setShowUsernameModal(true);
      } else {
        setWalletConnectError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setWalletConnectError(err.message || 'Connection failed. Please try again.');
    } finally {
      setWalletConnecting(false);
    }
  };

  const submitUsername = async () => {
    const reserved = ['admin','mod','moderator','system','bot','null','undefined'];
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(usernameInput)) { setUsernameError('3-16 characters, letters/numbers/underscore only'); return; }
    if (reserved.includes(usernameInput.toLowerCase())) { setUsernameError('This username is reserved.'); return; }
    setUsernameError('');
    try {
      const response = await base44.functions.invoke('authWallet', { wallet_address: tempWalletAddress, username: usernameInput });
      const data = response.data;
      if (data.success) {
        const u = data.user || data.player;
        saveUser(u);
        setShowUsernameModal(false);
        window.dispatchEvent(new Event('userAuthChanged'));
      } else {
        setUsernameError(data.error || 'Registration failed');
      }
    } catch (err) {
      setUsernameError(err.message || 'Registration failed');
    }
  };

  const w = detectWallets();
  const btnStyle = (installed, highlight) => ({
    background: highlight && installed ? 'linear-gradient(135deg,#7dff7d22,#7dff7d11)' : 'transparent',
    border: `${highlight && installed ? '2px' : '1px'} solid ${installed ? (highlight ? '#7dff7d' : '#444') : '#2a2a2a'}`,
    color: installed ? (highlight ? '#7dff7d' : '#e0e0e0') : '#444',
    padding: '14px 20px',
    cursor: installed ? 'pointer' : 'default',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '14px',
    textAlign: 'left',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%',
  });

  return (
    <>
      {showWalletModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.92)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
          onClick={() => setShowWalletModal(false)}>
          <div style={{ background:'#111', border:'2px solid #7dff7d', padding:'32px', width:'100%', maxWidth:'420px', fontFamily:"'Share Tech Mono',monospace" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'Rubik Mono One',monospace", color:'#7dff7d', fontSize:'20px', letterSpacing:'3px', marginBottom:'24px', textAlign:'center' }}>CONNECT WALLET</div>

            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[
                { type: 'x1', label: '⭐ X1 Wallet', installed: w.x1, highlight: true, installUrl: 'https://chromewebstore.google.com/detail/kcfmcpdmlchhbikbogddmgopmjbflnae' },
                { type: 'phantom', label: '👻 Phantom', installed: w.phantom, installUrl: 'https://phantom.app' },
                { type: 'backpack', label: '🎒 Backpack', installed: w.backpack, installUrl: 'https://www.backpack.app' },
                { type: 'metamask', label: '🦊 MetaMask', installed: w.metamask, installUrl: 'https://metamask.io' },
              ].map(({ type, label, installed, highlight, installUrl }) => (
                installed ? (
                  <button key={type} style={btnStyle(true, highlight)} onClick={() => connectWallet(type)}>
                    <span>{label}</span>
                    {highlight && <span style={{ background:'#7dff7d', color:'#0a0a0a', padding:'2px 8px', fontSize:'10px', fontWeight:'bold' }}>RECOMMENDED</span>}
                  </button>
                ) : (
                  <div key={type} style={btnStyle(false, false)}>
                    <span>{label} (Not Installed)</span>
                    <a href={installUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#7dff7d', fontSize:'11px' }}>Install →</a>
                  </div>
                )
              ))}
            </div>

            {walletConnecting && <div style={{ textAlign:'center', color:'#7dff7d', fontSize:'12px', marginTop:'12px' }}>Connecting...</div>}
            {walletConnectError && <div style={{ marginTop:'12px', padding:'10px', background:'rgba(255,68,68,0.08)', border:'1px solid #ff4444', color:'#ff4444', fontSize:'12px', textAlign:'center' }}>⚠ {walletConnectError}</div>}

            <button onClick={() => setShowWalletModal(false)} style={{ background:'transparent', border:'none', color:'#444', padding:'16px', width:'100%', marginTop:'16px', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'12px' }}>CANCEL</button>
          </div>
        </div>
      )}

      {showUsernameModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.92)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'#111', border:'2px solid #7dff7d', padding:'32px', width:'100%', maxWidth:'420px', fontFamily:"'Share Tech Mono',monospace" }}>
            <div style={{ fontFamily:"'Rubik Mono One',monospace", color:'#7dff7d', fontSize:'20px', letterSpacing:'3px', marginBottom:'8px', textAlign:'center' }}>SET USERNAME</div>
            <div style={{ color:'#ffaa00', fontSize:'11px', textAlign:'center', marginBottom:'20px' }}>⚠️ Username is PERMANENT and cannot be changed!</div>
            <input
              style={{ width:'100%', padding:'10px 12px', background:'#1a1a2a', border:'1px solid #2a2a4a', color:'#e0e0e0', fontFamily:"'Share Tech Mono',monospace", fontSize:'13px', outline:'none', boxSizing:'border-box', marginBottom:'12px' }}
              type="text" placeholder="your_username (3-16 chars)"
              value={usernameInput} onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitUsername()} maxLength={16} autoFocus
            />
            {usernameError && <div style={{ color:'#ff4444', fontSize:'11px', marginBottom:'12px' }}>⚠ {usernameError}</div>}
            <button onClick={submitUsername} style={{ width:'100%', padding:'12px', border:'2px solid #7dff7d', background:'transparent', color:'#7dff7d', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'14px', letterSpacing:'1px' }}>
              CONFIRM & LOCK USERNAME
            </button>
          </div>
        </div>
      )}
    </>
  );
}