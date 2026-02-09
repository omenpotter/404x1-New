import React from 'react';

export default function Home() {
    const appUrl = window.location.origin;
    
    const endpoints = [
        {
            method: 'POST',
            path: '/api/authWallet',
            description: 'Simple Web3 auth - just wallet + username (no signature needed)',
            request: {
                wallet_address: "4o4BGwEg5DgCyc89TK2qXaaYRTb3FCtqLbvFyr4w8ddT",
                username: "crypto_king" // 4-12 chars, alphanumeric + underscore
            },
            response: {
                success: true,
                user: {
                    id: "user_id",
                    wallet_address: "4o4BGwEg5DgCyc89TK2qXaaYRTb3FCtqLbvFyr4w8ddT",
                    username: "crypto_king",
                    reputation_points: 0,
                    total_score: 0,
                    games_played: 0,
                    user_role: "member"
                }
            }
        },
        {
            method: 'POST',
            path: '/api/chatSend',
            description: 'Send a chat message (awards +1 RP)',
            request: {
                user_id: "user_id",
                message: "Hello world!"
            },
            response: {
                success: true,
                message: {
                    id: "msg_id",
                    user_id: "user_id",
                    username: "player123",
                    message: "Hello world!",
                    created_date: "2026-02-09T..."
                }
            }
        },
        {
            method: 'GET',
            path: '/api/chatHistory?limit=50&offset=0',
            description: 'Get chat message history',
            response: {
                success: true,
                messages: [
                    {
                        id: "msg_id",
                        user_id: "user_id",
                        username: "player123",
                        message: "Hello!",
                        created_date: "2026-02-09T..."
                    }
                ],
                total: 150
            }
        },
        {
            method: 'POST',
            path: '/api/chatAwardRp',
            description: 'Award RP to another user (1-10 RP)',
            request: {
                from_user_id: "user_id_1",
                to_user_id: "user_id_2",
                amount: 5,
                reason: "Great contribution!"
            },
            response: {
                success: true,
                message: "RP awarded successfully"
            }
        },
        {
            method: 'POST',
            path: '/api/gameSubmit',
            description: 'Submit game score (awards RP based on score)',
            request: {
                user_id: "user_id",
                score: 1500
            },
            response: {
                success: true,
                score_record: {
                    id: "score_id",
                    user_id: "user_id",
                    username: "player123",
                    score: 1500
                },
                rp_earned: 1.5
            }
        },
        {
            method: 'GET',
            path: '/api/gameLeaderboard?limit=100&sortBy=total_score',
            description: 'Get game leaderboard',
            response: {
                success: true,
                leaderboard: [
                    {
                        rank: 1,
                        username: "player123",
                        reputation_points: 1500,
                        total_score: 50000,
                        games_played: 25,
                        user_role: "trusted"
                    }
                ]
            }
        },
        {
            method: 'GET',
            path: '/api/gameStats?user_id=user_id',
            description: 'Get user game statistics',
            response: {
                success: true,
                stats: {
                    username: "player123",
                    total_score: 50000,
                    games_played: 25,
                    average_score: 2000,
                    high_score: 5000,
                    recent_scores: [5000, 3000, 2500]
                }
            }
        }
    ];

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-6xl font-bold text-green-400 mb-4">404x1 API</h1>
                    <p className="text-slate-400 text-xl">Backend API Endpoints Ready</p>
                    <div className="mt-4 p-4 bg-slate-800 rounded-lg inline-block">
                        <p className="text-sm text-slate-300">Base URL</p>
                        <code className="text-green-400 text-lg">{appUrl}</code>
                    </div>
                </div>

                {/* Entities */}
                <div className="mb-12 bg-slate-800 rounded-lg p-6 border border-slate-700">
                    <h2 className="text-2xl font-bold text-green-400 mb-4">📦 Database Entities</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-4 rounded">
                            <span className="text-green-400 font-mono">User</span>
                            <p className="text-xs text-slate-400 mt-1">Wallet auth & profiles</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded">
                            <span className="text-green-400 font-mono">Message</span>
                            <p className="text-xs text-slate-400 mt-1">Chat messages</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded">
                            <span className="text-green-400 font-mono">Score</span>
                            <p className="text-xs text-slate-400 mt-1">Game scores</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded">
                            <span className="text-green-400 font-mono">RpAward</span>
                            <p className="text-xs text-slate-400 mt-1">RP transfers</p>
                        </div>
                    </div>
                </div>

                {/* API Endpoints */}
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold text-green-400 mb-6">🔌 API Endpoints</h2>
                    
                    {endpoints.map((endpoint, index) => (
                        <div key={index} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                            <div className="flex items-center gap-4 mb-4">
                                <span className={`px-3 py-1 rounded font-mono text-sm font-bold ${
                                    endpoint.method === 'POST' ? 'bg-blue-600' : 'bg-green-600'
                                }`}>
                                    {endpoint.method}
                                </span>
                                <code className="text-green-400 flex-1">{endpoint.path}</code>
                                <button
                                    onClick={() => copyToClipboard(appUrl + endpoint.path.split('?')[0])}
                                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                                >
                                    Copy URL
                                </button>
                            </div>
                            
                            <p className="text-slate-300 mb-4">{endpoint.description}</p>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                                {endpoint.request && (
                                    <div>
                                        <p className="text-sm text-slate-400 mb-2">Request Body:</p>
                                        <pre className="bg-slate-900 p-3 rounded text-xs overflow-x-auto">
                                            <code className="text-green-300">
                                                {JSON.stringify(endpoint.request, null, 2)}
                                            </code>
                                        </pre>
                                    </div>
                                )}
                                
                                <div>
                                    <p className="text-sm text-slate-400 mb-2">Response:</p>
                                    <pre className="bg-slate-900 p-3 rounded text-xs overflow-x-auto">
                                        <code className="text-cyan-300">
                                            {JSON.stringify(endpoint.response, null, 2)}
                                        </code>
                                    </pre>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CORS Notice */}
                <div className="mt-12 bg-yellow-900 border border-yellow-600 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-yellow-400 mb-2">⚠️ CORS Configuration</h3>
                    <p className="text-yellow-100">
                        All endpoints are configured to allow cross-origin requests from your frontend.
                        Include credentials in your fetch requests if needed.
                    </p>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-slate-500 text-sm">
                    <p>404x1 Backend API • Built with Base44</p>
                </div>
            </div>
        </div>
    );
}