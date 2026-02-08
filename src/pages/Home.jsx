import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Wallet, MessageSquare, Gamepad2, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
    const [user, setUser] = useState(null);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        // Check if user is already logged in
        const savedUser = localStorage.getItem('404x1_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
    }, []);

    const connectWallet = async () => {
        setConnecting(true);
        try {
            // Check if MetaMask is installed
            if (typeof window.ethereum === 'undefined') {
                alert('Please install MetaMask to continue');
                return;
            }

            // Request account access
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            const walletAddress = accounts[0];

            // Create message to sign
            const message = `Sign this message to authenticate with 404x1\nTimestamp: ${Date.now()}`;

            // Request signature
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, walletAddress]
            });

            // Check if user exists or needs username
            let username = null;
            const existingUser = localStorage.getItem('404x1_user');
            if (!existingUser) {
                username = prompt('Enter your username:');
                if (!username) {
                    alert('Username is required');
                    return;
                }
            }

            // Authenticate with backend
            const response = await base44.functions.invoke('authWallet', {
                wallet_address: walletAddress,
                signature: signature,
                message: message,
                username: username
            });

            if (response.data.success) {
                const userData = response.data.user;
                localStorage.setItem('404x1_user', JSON.stringify(userData));
                setUser(userData);
            } else {
                alert(response.data.error || 'Authentication failed');
            }

        } catch (error) {
            console.error('Connection error:', error);
            alert('Failed to connect wallet');
        } finally {
            setConnecting(false);
        }
    };

    const disconnect = () => {
        localStorage.removeItem('404x1_user');
        setUser(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            {/* Header */}
            <header className="border-b border-purple-500/30 bg-black/20 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                        404x1
                    </h1>
                    
                    {user ? (
                        <div className="flex items-center gap-4">
                            <div className="text-sm">
                                <div className="font-semibold">{user.username}</div>
                                <div className="text-purple-300">{user.reputation_points} RP</div>
                            </div>
                            <Button onClick={disconnect} variant="outline" size="sm">
                                Disconnect
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={connectWallet} disabled={connecting}>
                            <Wallet className="w-4 h-4 mr-2" />
                            {connecting ? 'Connecting...' : 'Connect Wallet'}
                        </Button>
                    )}
                </div>
            </header>

            {/* Hero Section */}
            <div className="container mx-auto px-4 py-20 text-center">
                <h2 className="text-6xl font-bold mb-6 animate-pulse">
                    Welcome to 404x1
                </h2>
                <p className="text-xl text-purple-200 mb-12 max-w-2xl mx-auto">
                    A Web3-powered chat and gaming platform. Connect your wallet to start earning reputation points!
                </p>

                {user ? (
                    <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        <Link to="/Chat">
                            <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-6 hover:bg-purple-900/50 transition cursor-pointer">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                                <h3 className="text-xl font-semibold mb-2">Chat</h3>
                                <p className="text-sm text-purple-200">Join the conversation and earn RP</p>
                            </div>
                        </Link>

                        <Link to="/Game">
                            <div className="bg-pink-900/30 border border-pink-500/50 rounded-lg p-6 hover:bg-pink-900/50 transition cursor-pointer">
                                <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-pink-400" />
                                <h3 className="text-xl font-semibold mb-2">Game</h3>
                                <p className="text-sm text-pink-200">Play and compete for high scores</p>
                            </div>
                        </Link>

                        <Link to="/Leaderboard">
                            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-6 hover:bg-blue-900/50 transition cursor-pointer">
                                <Trophy className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                                <h3 className="text-xl font-semibold mb-2">Leaderboard</h3>
                                <p className="text-sm text-blue-200">See top players and rankings</p>
                            </div>
                        </Link>
                    </div>
                ) : (
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-8 max-w-md mx-auto">
                        <Wallet className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                        <p className="text-lg mb-4">Connect your wallet to get started</p>
                        <Button onClick={connectWallet} disabled={connecting} size="lg" className="w-full">
                            {connecting ? 'Connecting...' : 'Connect Wallet'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}