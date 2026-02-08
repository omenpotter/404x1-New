import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';

export default function Leaderboard() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('total_score');

    useEffect(() => {
        loadLeaderboard();
    }, [sortBy]);

    const loadLeaderboard = async () => {
        setLoading(true);
        try {
            const response = await base44.functions.invoke('gameLeaderboard', {});
            if (response.data.success) {
                setLeaderboard(response.data.leaderboard);
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin': return 'text-red-400';
            case 'trusted': return 'text-yellow-400';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <header className="border-b border-purple-500/30 bg-black/20 backdrop-blur-sm p-4">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Home')}>
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold">Leaderboard</h1>
                    </div>
                </div>
            </header>

            <div className="container mx-auto p-8">
                {/* Sort Tabs */}
                <div className="flex gap-2 mb-6 justify-center">
                    <Button
                        onClick={() => setSortBy('total_score')}
                        variant={sortBy === 'total_score' ? 'default' : 'outline'}
                    >
                        <Trophy className="w-4 h-4 mr-2" />
                        Top Scores
                    </Button>
                    <Button
                        onClick={() => setSortBy('reputation_points')}
                        variant={sortBy === 'reputation_points' ? 'default' : 'outline'}
                    >
                        <Zap className="w-4 h-4 mr-2" />
                        Top RP
                    </Button>
                </div>

                {/* Leaderboard Table */}
                {loading ? (
                    <div className="text-center py-12">Loading...</div>
                ) : (
                    <div className="max-w-4xl mx-auto bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="p-4 text-left">Rank</th>
                                    <th className="p-4 text-left">Player</th>
                                    <th className="p-4 text-center">RP</th>
                                    <th className="p-4 text-center">Score</th>
                                    <th className="p-4 text-center">Games</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((player, index) => (
                                    <tr 
                                        key={index}
                                        className="border-t border-slate-700 hover:bg-slate-700/30 transition"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {player.rank <= 3 ? (
                                                    <Trophy className={`w-5 h-5 ${
                                                        player.rank === 1 ? 'text-yellow-400' :
                                                        player.rank === 2 ? 'text-slate-300' :
                                                        'text-orange-400'
                                                    }`} />
                                                ) : (
                                                    <span className="w-5 text-center">{player.rank}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">{player.username}</span>
                                                <span className={`text-xs ${getRoleColor(player.role)}`}>
                                                    {player.role}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center text-purple-300 font-semibold">
                                            {player.reputation_points}
                                        </td>
                                        <td className="p-4 text-center font-semibold">
                                            {player.total_score}
                                        </td>
                                        <td className="p-4 text-center text-slate-400">
                                            {player.games_played}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Info */}
                <div className="max-w-4xl mx-auto mt-8 bg-purple-900/20 border border-purple-500/30 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        Reputation System
                    </h3>
                    <ul className="space-y-2 text-slate-300">
                        <li>• Earn 1 RP per chat message sent</li>
                        <li>• Earn 1 RP per 100 points in games</li>
                        <li>• Reach 10,000 RP to unlock the "Trusted" role</li>
                        <li>• Award RP to other players (costs your own RP)</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}