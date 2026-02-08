import React from 'react';

export default function Home() {
    return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-4xl font-bold mb-4">404x1</h1>
                <p className="text-slate-400">Web3 Backend APIs are ready</p>
                <div className="mt-8 space-y-2 text-sm text-slate-500">
                    <p>✓ Entities: User, Message, Score, RpAward</p>
                    <p>✓ APIs: authWallet, chatSend, chatHistory, chatAwardRp, gameSubmit, gameLeaderboard, gameStats</p>
                </div>
            </div>
        </div>
    );
}