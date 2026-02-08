import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Chat() {
    const [user, setUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('404x1_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
            loadMessages();
        } else {
            window.location.href = '/';
        }
    }, []);

    const loadMessages = async () => {
        try {
            const response = await base44.functions.invoke('chatHistory', {});
            if (response.data.success) {
                setMessages(response.data.messages.reverse());
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        setSending(true);
        try {
            const response = await base44.functions.invoke('chatSend', {
                user_id: user.id,
                message: newMessage.trim()
            });

            if (response.data.success) {
                setMessages([...messages, response.data.message]);
                setNewMessage('');
                
                // Update local user RP
                const updatedUser = { ...user, reputation_points: user.reputation_points + 1 };
                localStorage.setItem('404x1_user', JSON.stringify(updatedUser));
                setUser(updatedUser);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                Loading...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col">
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
                        <h1 className="text-2xl font-bold">404x1 Chat</h1>
                    </div>
                    {user && (
                        <div className="text-sm">
                            <span className="font-semibold">{user.username}</span>
                            <span className="text-purple-300 ml-2">{user.reputation_points} RP</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="container mx-auto max-w-4xl space-y-4">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-lg ${
                                msg.user_id === user?.id
                                    ? 'bg-purple-900/30 border border-purple-500/50 ml-auto max-w-[80%]'
                                    : 'bg-slate-800/50 border border-slate-700 mr-auto max-w-[80%]'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-purple-300">
                                    {msg.username}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {new Date(msg.created_date).toLocaleTimeString()}
                                </span>
                            </div>
                            <p>{msg.message}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Input */}
            <div className="border-t border-purple-500/30 bg-black/20 backdrop-blur-sm p-4">
                <form onSubmit={sendMessage} className="container mx-auto max-w-4xl flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        maxLength={500}
                        className="flex-1 bg-slate-800 border-slate-700"
                        disabled={sending}
                    />
                    <Button type="submit" disabled={sending || !newMessage.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
                <div className="text-xs text-slate-400 text-center mt-2">
                    {newMessage.length}/500 • Earn 1 RP per message
                </div>
            </div>
        </div>
    );
}