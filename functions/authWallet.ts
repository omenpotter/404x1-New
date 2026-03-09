// auth.js - COMPLETE FIX: Proper auto-login for returning users
// Assumes backend checks wallet first, returns existing player if found

window.API_ENDPOINTS = {
    authWallet: 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/authWallet',
    chatSend: 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/chatSend',
    chatHistory: 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/chatHistory',
    chatAwardRp: 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/chatAwardRp',
    gameSubmit: 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/gameSubmit',
    gameLeaderboard: 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/gameLeaderboard',
    gameStats: 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/gameStats'
};

let currentUser = null;
let tempWalletAddress = null;

function detectWallets() {
    return {
        x1: typeof window.x1Wallet !== 'undefined',
        phantom: typeof window.phantom?.solana !== 'undefined',
        backpack: typeof window.backpack !== 'undefined',
        metamask: typeof window.ethereum !== 'undefined'
    };
}

function showWalletModal() {
    const wallets = detectWallets();
    
    const modalHTML = `
        <div id="wallet-modal" style="
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.9); display: flex;
            align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: #1a1a1a; border: 2px solid #00ff00; border-radius: 10px;
                padding: 30px; max-width: 400px; width: 90%;">
                <h2 style="color: #00ff00; margin-bottom: 20px; text-align: center;">Connect Wallet</h2>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    ${wallets.x1 ? `
                        <button onclick="connectWallet('x1')" style="background: linear-gradient(135deg, #00ff00, #00cc00);
                            color: #000; border: none; padding: 15px 20px; border-radius: 8px;
                            font-size: 16px; font-weight: bold; cursor: pointer; display: flex;
                            align-items: center; justify-content: space-between;">
                            <span>X1 Wallet</span>
                            <span style="background: #000; color: #00ff00; padding: 2px 8px; border-radius: 4px; font-size: 12px;">RECOMMENDED</span>
                        </button>
                    ` : `<div style="background: rgba(255, 255, 255, 0.05); padding: 15px 20px; border-radius: 8px;
                            text-align: center; color: #666;">
                            <div>X1 Wallet (Not Installed)</div>
                            <a href="https://chromewebstore.google.com/detail/kcfmcpdmlchhbikbogddmgopmjbflnae" 
                               target="_blank" style="color: #00ff00; font-size: 12px; text-decoration: underline;">Install X1 Wallet</a>
                        </div>`}
                    ${wallets.phantom ? `<button onclick="connectWallet('phantom')" style="background: #1a1a1a; color: #fff;
                            border: 2px solid #666; padding: 15px 20px; border-radius: 8px;
                            font-size: 16px; font-weight: bold; cursor: pointer;">Phantom</button>` : ''}
                    ${wallets.backpack ? `<button onclick="connectWallet('backpack')" style="background: #1a1a1a; color: #fff;
                            border: 2px solid #666; padding: 15px 20px; border-radius: 8px;
                            font-size: 16px; font-weight: bold; cursor: pointer;">Backpack</button>` : ''}
                    ${wallets.metamask ? `<button onclick="connectWallet('metamask')" style="background: #1a1a1a; color: #fff;
                            border: 2px solid #666; padding: 15px 20px; border-radius: 8px;
                            font-size: 16px; font-weight: bold; cursor: pointer;">MetaMask</button>` : ''}
                </div>
                <button onclick="closeModal()" style="background: transparent; color: #666; border: none;
                    padding: 15px; width: 100%; margin-top: 20px; cursor: pointer;">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function connectWallet(walletType) {
    closeModal();
    
    try {
        let walletAddress;
        
        if (walletType === 'x1') {
            if (typeof window.x1Wallet === 'undefined') {
                alert('X1 Wallet not installed');
                return;
            }
            const response = await window.x1Wallet.connect();
            walletAddress = response.publicKey.toString();
            
        } else if (walletType === 'phantom') {
            if (!window.phantom?.solana) {
                alert('Phantom Wallet not installed');
                return;
            }
            const response = await window.phantom.solana.connect();
            walletAddress = response.publicKey.toString();
            
        } else if (walletType === 'backpack') {
            if (typeof window.backpack === 'undefined') {
                alert('Backpack Wallet not installed');
                return;
            }
            const response = await window.backpack.connect();
            walletAddress = response.publicKey.toString();
            
        } else if (walletType === 'metamask') {
            if (typeof window.ethereum === 'undefined') {
                alert('MetaMask not installed');
                return;
            }
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            walletAddress = accounts[0];
        }
        
        tempWalletAddress = walletAddress;
        
        // Try to login with dummy username (backend checks wallet first)
        await attemptLogin(walletAddress, 'temp_check_wallet');
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        alert('Failed to connect wallet. Please try again.');
    }
}

async function attemptLogin(walletAddress, username) {
    try {
        const response = await fetch(window.API_ENDPOINTS.authWallet, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: walletAddress,
                username: username
            })
        });
        
        const data = await response.json();
        
        console.log('Login response:', data); // DEBUG
        
        if (data.success) {
            // SUCCESS! Wallet was recognized OR new account created
            currentUser = data.user;
            localStorage.setItem('404x1_user', JSON.stringify(currentUser));
            
            // Check if this was a returning user
            if (username.startsWith('temp_check_')) {
                // Returning user - wallet was found
                alert(`Welcome back, ${currentUser.username}! 🎉`);
            } else {
                // New user - account just created
                alert(`Welcome, ${currentUser.username}! 🎉`);
            }
            
            updateUIForLoggedInUser();
            
            // Trigger event for other pages to update
            window.dispatchEvent(new Event('userLoggedIn'));
            
        } else if (data.error) {
            // Check specific error types
            if (data.error.includes('Username must be') || 
                data.error.includes('Username already taken')) {
                // New wallet, invalid username - ask for valid username
                showUsernameInput();
            } else {
                // Other error
                alert('Login failed: ' + data.error);
            }
        }
        
    } catch (error) {
        console.error('Login attempt error:', error);
        alert('Login failed. Please try again.');
    }
}

function showUsernameInput() {
    const modalHTML = `
        <div id="username-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.9); display: flex; align-items: center;
            justify-content: center; z-index: 10000;">
            <div style="background: #1a1a1a; border: 2px solid #00ff00; border-radius: 10px;
                padding: 30px; max-width: 400px; width: 90%;">
                <h2 style="color: #00ff00; margin-bottom: 10px; text-align: center;">Choose Your Username</h2>
                <p style="color: #888; font-size: 14px; text-align: center; margin-bottom: 20px;">
                    4-12 characters (letters, numbers, underscore)<br>
                    <strong style="color: #ff9900;">⚠️ Cannot be changed later!</strong>
                </p>
                <input type="text" id="username-input" placeholder="Enter username..." maxlength="12"
                    style="width: 100%; padding: 15px; background: #0a0a0a; border: 2px solid #333;
                    border-radius: 8px; color: #fff; font-size: 16px; margin-bottom: 10px; box-sizing: border-box;" />
                <div id="username-error" style="color: #ff4444; font-size: 12px; margin-bottom: 15px; min-height: 20px;"></div>
                <button onclick="submitUsername()" style="background: linear-gradient(135deg, #00ff00, #00cc00);
                    color: #000; border: none; padding: 15px; border-radius: 8px; font-size: 16px;
                    font-weight: bold; cursor: pointer; width: 100%;">Create Account</button>
                <button onclick="closeModal()" style="background: transparent; color: #666; border: none;
                    padding: 15px; width: 100%; margin-top: 10px; cursor: pointer;">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
        const input = document.getElementById('username-input');
        if (input) {
            input.focus();
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitUsername();
            });
        }
    }, 100);
}

function submitUsername() {
    const input = document.getElementById('username-input');
    const username = input.value.trim();
    const errorDiv = document.getElementById('username-error');
    
    if (username.length < 4 || username.length > 12) {
        errorDiv.textContent = 'Username must be 4-12 characters';
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errorDiv.textContent = 'Only letters, numbers, and underscore allowed';
        return;
    }
    
    errorDiv.textContent = '';
    closeModal();
    
    if (tempWalletAddress) {
        attemptLogin(tempWalletAddress, username);
    } else {
        alert('Wallet connection lost. Please try again.');
    }
}

function logout() {
    currentUser = null;
    tempWalletAddress = null;
    localStorage.removeItem('404x1_user');
    updateUIForLoggedOutUser();
    
    // Trigger event for other pages
    window.dispatchEvent(new Event('userLoggedOut'));
}

function closeModal() {
    ['wallet-modal', 'username-modal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.remove();
    });
}

function updateUIForLoggedInUser() {
    const loginButtons = document.querySelectorAll('#login-btn, #authBtn, .nav-cta');
    const userInfoElements = document.querySelectorAll('#user-info, .user-info');
    
    loginButtons.forEach(btn => {
        if (btn) btn.style.display = 'none';
    });
    
    userInfoElements.forEach(userInfo => {
        if (userInfo) {
            userInfo.style.display = 'flex';
            userInfo.innerHTML = `
                <span style="color: #00ff00; font-weight: bold;">${currentUser.username}</span>
                <span style="color: #fff; margin-left: 10px;">${currentUser.reputation_points} RP</span>
                <button onclick="logout()" style="background: rgba(255, 0, 0, 0.2); border: 1px solid #ff0000;
                    color: #ff0000; padding: 5px 15px; border-radius: 5px; cursor: pointer;
                    margin-left: 15px; font-size: 12px;">LOGOUT</button>
            `;
        }
    });
    
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    if (messageInput) {
        messageInput.disabled = false;
        messageInput.placeholder = 'Type your message...';
    }
    if (sendBtn) {
        sendBtn.disabled = false;
    }
}

function updateUIForLoggedOutUser() {
    const loginButtons = document.querySelectorAll('#login-btn, #authBtn, .nav-cta');
    const userInfoElements = document.querySelectorAll('#user-info, .user-info');
    
    loginButtons.forEach(btn => {
        if (btn) btn.style.display = 'block';
    });
    
    userInfoElements.forEach(userInfo => {
        if (userInfo) userInfo.style.display = 'none';
    });
    
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    if (messageInput) {
        messageInput.disabled = true;
        messageInput.placeholder = 'Please login to chat';
    }
    if (sendBtn) {
        sendBtn.disabled = true;
    }
}

function loadSession() {
    const saved = localStorage.getItem('404x1_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        updateUIForLoggedInUser();
    }
}

function setupLoginButtons() {
    const buttons = document.querySelectorAll('#login-btn, #authBtn, .nav-cta');
    buttons.forEach(btn => {
        btn.removeAttribute('onclick');
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            showWalletModal();
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadSession();
    setupLoginButtons();
});

if (document.readyState !== 'loading') {
    loadSession();
    setupLoginButtons();
}

window.connectWallet = connectWallet;
window.submitUsername = submitUsername;
window.closeModal = closeModal;
window.logout = logout;
window.showWalletModal = showWalletModal;
