import Chat from './pages/Chat';
import Docs from './pages/Docs';
import Game from './pages/Game';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Messages from './pages/Messages';
import ModerationLogs from './pages/ModerationLogs';
import __Layout from './Layout.jsx';

export const PAGES = {
    "Chat": Chat,
    "Docs": Docs,
    "Game": Game,
    "Home": Home,
    "Leaderboard": Leaderboard,
    "Messages": Messages,
    "ModerationLogs": ModerationLogs,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
