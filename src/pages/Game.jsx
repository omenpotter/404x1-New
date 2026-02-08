import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Game() {
    const [user, setUser] = useState(null);
    const [gameActive, setGameActive] = useState(false);
    const [score, setScore] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('404x1_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        } else {
            window.location.href = '/';
        }
    }, []);

    const startGame = () => {
        setGameActive(true);
        setScore(0);
        
        // Simple demo game: click anywhere to increase score
        // Replace this with your actual game logic
        const interval = setInterval(() => {
            setScore(prev => prev + 10);
        }, 1000);

        // Auto-end game after 30 seconds
        setTimeout(() => {
            clearInterval(interval);
            endGame();
        }, 30000);
    };

    const endGame = async () => {
        setGameActive(false);
        if (!user || score === 0) return;

        setSubmitting(true);
        try {
            const response = await base44.functions.invoke('gameSubmit', {
                user_id: user.id,
                score: score
            });

            if (response.data.success) {
                alert(`Game Over! Score: ${score}\nRP Earned: ${response.data.rp_earned}`);
                
                // Update local user data
                const updatedUser = {
                    ...user,
                    total_score: user.total_score + score,
                    games_played: user.games_played + 1,
                    reputation_points: user.reputation_points + response.data.rp_earned
                };
                localStorage.setItem('404x1_user', JSON.stringify(updatedUser));
                setUser(updatedUser);
            }
        } catch (error) {
            console.error('Failed to submit score:', error);
            alert('Failed to submit score');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <header className="border-b border-purple-500/30 bg-black/20 backdrop-blur-sm p-4">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold">404x1 Game</h1>
                    </div>
                    {user && (
                        <div className="text-sm space-y-1 text-right">
                            <div>
                                <span className="font-semibold">{user.username}</span>
                                <span className="text-purple-300 ml-2">{user.reputation_points} RP</span>
                            </div>
                            <div className="text-xs text-slate-400">
                                Games: {user.games_played} | Total Score: {user.total_score}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Game Area */}
            <div className="container mx-auto p-8">
                {!gameActive ? (
                    <div className="max-w-2xl mx-auto text-center">
                        <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-12">
                            <h2 className="text-4xl font-bold mb-6">Ready to Play?</h2>
                            <p className="text-lg text-purple-200 mb-8">
                                Score points and earn RP! (1 RP per 100 points)
                            </p>
                            <Button onClick={startGame} size="lg" disabled={submitting}>
                                <Play className="w-5 h-5 mr-2" />
                                Start Game
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-black border border-purple-500 rounded-lg p-8 mb-4">
                            <div className="text-center">
                                <div className="text-6xl font-bold mb-4">{score}</div>
                                <div className="text-xl text-purple-300">
                                    Click anywhere to increase score!
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <Button onClick={endGame} variant="destructive" disabled={submitting}>
                                {submitting ? 'Submitting...' : 'End Game'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="max-w-2xl mx-auto mt-12 bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-4">How to Play</h3>
                    <ul className="space-y-2 text-slate-300">
                        <li>• Click "Start Game" to begin</li>
                        <li>• Score increases automatically (demo mode)</li>
                        <li>• Game ends after 30 seconds or when you click "End Game"</li>
                        <li>• Earn 1 RP for every 100 points scored</li>
                        <li>• Your score is saved to the leaderboard</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}