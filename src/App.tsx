import { useState, useEffect, useRef } from 'react';
import { projectFiles, fileTree, ProjectFile, TreeNode } from './data/projectFiles';

// ─── Language Color Map ────────────────────────────────────────────────────

const langBg: Record<string, string> = {
  javascript: 'bg-yellow-900/30 text-yellow-300',
  json: 'bg-green-900/30 text-green-300',
  bash: 'bg-emerald-900/30 text-emerald-300',
  markdown: 'bg-blue-900/30 text-blue-300',
};

// ─── Syntax Highlighter ────────────────────────────────────────────────────
function highlightJS(code: string): string {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Strings
    .replace(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g, '<span style="color:#98c379">$1$2$1</span>')
    // Comments
    .replace(/(\/\/[^\n]*)/g, '<span style="color:#5c6370;font-style:italic">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#5c6370;font-style:italic">$1</span>')
    // Keywords
    .replace(/\b(const|let|var|function|async|await|return|if|else|for|while|class|new|this|typeof|import|require|module|exports?|try|catch|throw|break|continue|switch|case|default|of|in|from|null|undefined|true|false)\b/g, '<span style="color:#c678dd">$1</span>')
    // Numbers
    .replace(/\b(\d+)\b/g, '<span style="color:#d19a66">$1</span>')
    // Function calls
    .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, '<span style="color:#61afef">$1</span>')
    // Object keys
    .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '<span style="color:#e06c75">$1</span>:');
}

function highlightJSON(code: string): string {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"((?:\\.|[^"\\])*)"\s*:/g, '<span style="color:#e06c75">"$1"</span>:')
    .replace(/:\s*"((?:\\.|[^"\\])*)"/g, ': <span style="color:#98c379">"$1"</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#d19a66">$1</span>')
    .replace(/:\s*(true|false|null)/g, ': <span style="color:#c678dd">$1</span>');
}

function highlightCode(code: string, language: string): string {
  if (language === 'json') return highlightJSON(code);
  if (language === 'javascript') return highlightJS(code);
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── File Tree Component ────────────────────────────────────────────────────
function FileTreeNode({ node, depth, selectedPath, onSelect }: {
  node: TreeNode;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isFolder = node.type === 'folder';
  const isSelected = node.path === selectedPath;

  const fileIcon = (name: string) => {
    if (name.endsWith('.js')) return '🟨';
    if (name.endsWith('.json')) return '📋';
    if (name.endsWith('.md')) return '📄';
    if (name.endsWith('.env.example') || name.includes('.env')) return '🔐';
    return '📄';
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-[3px] px-2 rounded cursor-pointer text-sm transition-all duration-150 ${
          isSelected
            ? 'bg-blue-600/30 text-blue-300 border-l-2 border-blue-400'
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          if (isFolder) setExpanded(!expanded);
          else if (node.path) onSelect(node.path);
        }}
      >
        {isFolder ? (
          <>
            <span className="text-xs text-gray-500">{expanded ? '▾' : '▸'}</span>
            <span className="text-yellow-400 text-xs">📁</span>
          </>
        ) : (
          <span className="text-xs">{fileIcon(node.name)}</span>
        )}
        <span className={`ml-1 ${isFolder ? 'text-yellow-300 font-medium' : ''}`}>
          {node.name}
        </span>
      </div>
      {isFolder && expanded && node.children?.map((child, i) => (
        <FileTreeNode
          key={i}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ─── Code Viewer Component ──────────────────────────────────────────────────
function CodeViewer({ file }: { file: ProjectFile }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);
  const lines = file.content.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1d27] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-gray-300 font-mono text-sm">{file.path}</span>
          <span className={`text-xs px-2 py-0.5 rounded font-mono ${langBg[file.language] || 'bg-gray-700 text-gray-300'}`}>
            {file.language}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs">{lines.length} lines</span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all duration-200 ${
              copied
                ? 'bg-green-600/30 text-green-400 border border-green-500/40'
                : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-white/10'
            }`}
          >
            {copied ? '✓ Copied!' : '⧉ Copy'}
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-2 bg-blue-900/20 border-b border-blue-500/20 flex-shrink-0">
        <p className="text-blue-300 text-xs">💡 {file.description}</p>
      </div>

      {/* Code with line numbers */}
      <div className="flex-1 overflow-auto" ref={codeRef}>
        <table className="w-full border-collapse min-w-full">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-white/[0.02] group">
                <td className="select-none text-right pr-4 pl-4 text-gray-600 text-xs font-mono w-12 py-0 leading-6 align-top border-r border-white/5 group-hover:text-gray-500">
                  {idx + 1}
                </td>
                <td className="pl-4 pr-4 py-0 leading-6 font-mono text-xs text-gray-300 whitespace-pre">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: highlightCode(line || ' ', file.language),
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Feature Card ────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  return (
    <div className={`p-4 rounded-xl border ${color} bg-opacity-10 backdrop-blur-sm`}>
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
      <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

// ─── Setup Step ──────────────────────────────────────────────────────────────
function SetupStep({ num, title, code }: { num: number; title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
        {num}
      </div>
      <div className="flex-1">
        <p className="text-gray-300 text-sm font-medium mb-2">{title}</p>
        <div className="relative group">
          <pre className="bg-black/40 border border-white/10 rounded-lg p-3 text-green-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {code}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-white/10 hover:bg-white/20 text-gray-300 px-2 py-1 rounded"
          >
            {copied ? '✓' : '⧉'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'code' | 'setup' | 'api'>('overview');
  const [selectedFilePath, setSelectedFilePath] = useState('server.js');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState<ProjectFile[]>(projectFiles);

  const selectedFile = projectFiles.find(f => f.path === selectedFilePath) || projectFiles[0];

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFiles(projectFiles);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredFiles(
        projectFiles.filter(f =>
          f.path.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.content.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery]);

  const stats = [
    { label: 'Files', value: projectFiles.length, icon: '📁' },
    { label: 'Lines of Code', value: projectFiles.reduce((acc, f) => acc + f.content.split('\n').length, 0).toLocaleString(), icon: '📝' },
    { label: 'Features', value: '8', icon: '⚡' },
    { label: 'Commands', value: '9', icon: '🤖' },
  ];

  return (
    <div className="min-h-screen bg-[#0d0f1a] text-white flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top Header ── */}
      <header className="border-b border-white/10 bg-[#0d0f1a]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg">
              🎮
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-none">Telegram Game Bot</h1>
              <p className="text-gray-500 text-xs mt-0.5">AI-Powered Multiplayer • Production Ready</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs bg-green-900/30 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              Production Ready
            </span>
            <span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-full">
              Node.js 18+
            </span>
            <span className="text-xs bg-purple-900/30 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-full">
              Telegraf v4
            </span>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="max-w-screen-2xl mx-auto px-4 flex gap-1 pb-0">
          {(['overview', 'code', 'setup', 'api'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'overview' && '🏠 '}
              {tab === 'code' && '📂 '}
              {tab === 'setup' && '⚙️ '}
              {tab === 'api' && '🤖 '}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-4 py-8">

            {/* Hero */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-500/30 text-blue-300 text-xs px-4 py-1.5 rounded-full mb-4">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                Complete Production-Ready Project
              </div>
              <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-3">
                AI-Powered Telegram Game Bot
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-sm leading-relaxed">
                A full-stack multiplayer gaming platform built on Telegram with Tic Tac Toe, Quiz Battle,
                coin economy, leaderboards, and OpenRouter AI integration. Built with Node.js, Telegraf, MongoDB & WebSockets.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Bot Token Banner */}
            <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-xl p-5 mb-8">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">Bot Configuration</h3>
                  <p className="text-gray-400 text-sm mb-3">Your bot token is pre-configured in the project:</p>
                  <div className="bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-xs">
                    <span className="text-gray-500">BOT_TOKEN=</span>
                    <span className="text-green-400">8392101543:AAF_vP6_Y-5lSTJ3O8ZvFFT0pI_2_wTgebE</span>
                  </div>
                  <p className="text-yellow-400 text-xs mt-2">⚠️ Keep your bot token private! Never commit it to public repositories.</p>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <h3 className="text-white font-bold text-lg mb-4">🚀 Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <FeatureCard
                icon="🎮"
                title="Tic Tac Toe"
                desc="PvP and AI modes with inline keyboard UI, invite system, turn-based logic, and win/draw detection"
                color="border-yellow-500/30"
              />
              <FeatureCard
                icon="🧠"
                title="Quiz Battle"
                desc="AI-generated questions via OpenRouter, 15-second timer per question, score tracking and rewards"
                color="border-purple-500/30"
              />
              <FeatureCard
                icon="💰"
                title="Coin Economy"
                desc="Starting coins for new users, entry fees, betting system, win rewards, and daily bonuses"
                color="border-green-500/30"
              />
              <FeatureCard
                icon="🏆"
                title="Leaderboard"
                desc="Real-time rankings by coins and wins. Top 10 players displayed with medals and stats"
                color="border-blue-500/30"
              />
              <FeatureCard
                icon="🤖"
                title="AI Integration"
                desc="OpenRouter API powers minimax Tic Tac Toe AI, quiz generation, and chat assistant"
                color="border-red-500/30"
              />
              <FeatureCard
                icon="⚡"
                title="WebSocket"
                desc="Real-time game state updates, player moves, and quiz timers via WebSocket server"
                color="border-orange-500/30"
              />
              <FeatureCard
                icon="🛡️"
                title="Anti-Spam"
                desc="Rate limiting middleware with 5 messages per 5-second window. Prevents abuse automatically"
                color="border-cyan-500/30"
              />
              <FeatureCard
                icon="📊"
                title="Match History"
                desc="All games saved to MongoDB with full board state, players, winners, and timestamps"
                color="border-pink-500/30"
              />
            </div>

            {/* Tech Stack */}
            <h3 className="text-white font-bold text-lg mb-4">⚙️ Tech Stack</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
              {[
                { name: 'Node.js 18+', color: 'bg-green-900/30 border-green-500/30 text-green-300', icon: '🟢' },
                { name: 'Telegraf v4', color: 'bg-blue-900/30 border-blue-500/30 text-blue-300', icon: '✈️' },
                { name: 'MongoDB', color: 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300', icon: '🍃' },
                { name: 'Express.js', color: 'bg-yellow-900/30 border-yellow-500/30 text-yellow-300', icon: '🚂' },
                { name: 'WebSocket', color: 'bg-purple-900/30 border-purple-500/30 text-purple-300', icon: '⚡' },
                { name: 'OpenRouter', color: 'bg-red-900/30 border-red-500/30 text-red-300', icon: '🤖' },
              ].map((tech, i) => (
                <div key={i} className={`${tech.color} border rounded-xl p-3 text-center`}>
                  <div className="text-xl mb-1">{tech.icon}</div>
                  <div className="text-xs font-semibold">{tech.name}</div>
                </div>
              ))}
            </div>

            {/* Commands */}
            <h3 className="text-white font-bold text-lg mb-4">📡 Bot Commands</h3>
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-10">
              {[
                { cmd: '/start', desc: 'Welcome message + main menu', fee: '' },
                { cmd: '/play', desc: 'Game selection menu', fee: '' },
                { cmd: '/tictactoe', desc: 'Start Tic Tac Toe (AI or PvP)', fee: '10 coins' },
                { cmd: '/quiz', desc: 'Start Quiz Battle (5 AI questions)', fee: '10 coins' },
                { cmd: '/balance', desc: 'View coins, wins, losses, win rate', fee: '' },
                { cmd: '/leaderboard', desc: 'Top 10 by coins and wins', fee: '' },
                { cmd: '/bet [amount]', desc: 'Set bet for next game (10–1000)', fee: '' },
                { cmd: '/ai [message]', desc: 'Chat with OpenRouter AI', fee: '' },
                { cmd: '/help', desc: 'Full command list', fee: '' },
              ].map((item, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-3 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''} border-b border-white/5 last:border-0`}>
                  <div className="flex items-center gap-3">
                    <code className="text-blue-400 font-mono text-sm">{item.cmd}</code>
                    <span className="text-gray-400 text-sm">{item.desc}</span>
                  </div>
                  {item.fee && (
                    <span className="text-yellow-400 text-xs bg-yellow-900/30 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                      💰 {item.fee}
                    </span>
                  )}
                </div>
              ))}
            </div>

          </div>
        </main>
      )}

      {/* ── CODE EXPLORER TAB ── */}
      {activeTab === 'code' && (
        <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 97px)' }}>

          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 bg-[#13151f] border-r border-white/10 flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-white/10">
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* File tree or search results */}
            <div className="flex-1 overflow-auto py-2">
              {searchQuery ? (
                <div>
                  <p className="text-gray-600 text-xs px-3 py-1">{filteredFiles.length} results</p>
                  {filteredFiles.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedFilePath(f.path)}
                      className={`px-3 py-2 cursor-pointer text-xs transition-colors ${
                        selectedFilePath === f.path
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      <div className="font-mono truncate">{f.path}</div>
                      <div className="text-gray-600 truncate mt-0.5">{f.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                fileTree.map((node, i) => (
                  <FileTreeNode
                    key={i}
                    node={node}
                    depth={0}
                    selectedPath={selectedFilePath}
                    onSelect={setSelectedFilePath}
                  />
                ))
              )}
            </div>

            {/* File count */}
            <div className="p-3 border-t border-white/10">
              <p className="text-gray-600 text-xs text-center">{projectFiles.length} files total</p>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="flex-1 overflow-hidden bg-[#1e2030] flex flex-col">
            {selectedFile ? (
              <CodeViewer file={selectedFile} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a file to view its code
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SETUP TAB ── */}
      {activeTab === 'setup' && (
        <main className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold text-white mb-2">⚙️ Setup Guide</h2>
            <p className="text-gray-400 text-sm mb-8">Complete setup instructions for Termux (Android) and Linux environments</p>

            {/* Termux Setup */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h3 className="text-white font-bold text-lg mb-1">📱 Termux (Android) Setup</h3>
              <p className="text-gray-500 text-sm mb-6">Run this bot directly on your Android device</p>

              <div className="flex flex-col gap-6">
                <SetupStep num={1} title="Install prerequisites in Termux"
                  code={`pkg update && pkg upgrade -y\npkg install nodejs mongodb git curl -y`}
                />
                <SetupStep num={2} title="Create project directory and copy files"
                  code={`mkdir ~/telegram-bot\ncd ~/telegram-bot\n# Copy all project files into this directory`}
                />
                <SetupStep num={3} title="Install Node.js dependencies"
                  code={`npm install`}
                />
                <SetupStep num={4} title="Create your .env configuration file"
                  code={`cp .env.example .env\nnano .env`}
                />
                <SetupStep num={5} title="Start MongoDB in background"
                  code={`mkdir -p ~/mongodb-data\nmongod --dbpath ~/mongodb-data --fork --logpath ~/mongod.log\necho "MongoDB started!"`}
                />
                <SetupStep num={6} title="Run the bot"
                  code={`# Development mode (auto-restart)\nnpm run dev\n\n# OR Production mode\nnpm start`}
                />
              </div>
            </div>

            {/* Linux/VPS Setup */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h3 className="text-white font-bold text-lg mb-1">🖥️ Linux / VPS Setup</h3>
              <p className="text-gray-500 text-sm mb-6">Deploy on Ubuntu/Debian server</p>

              <div className="flex flex-col gap-6">
                <SetupStep num={1} title="Install Node.js 18 LTS"
                  code={`curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -\nsudo apt-get install -y nodejs`}
                />
                <SetupStep num={2} title="Install MongoDB"
                  code={`sudo apt-get install -y gnupg\ncurl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor\nsudo apt-get install -y mongodb-org\nsudo systemctl start mongod\nsudo systemctl enable mongod`}
                />
                <SetupStep num={3} title="Clone and install"
                  code={`git clone your-repo-url telegram-bot\ncd telegram-bot\nnpm install`}
                />
                <SetupStep num={4} title="Configure environment"
                  code={`cp .env.example .env\nnano .env\n# Set BOT_TOKEN, MONGODB_URI, OPENROUTER_API_KEY`}
                />
                <SetupStep num={5} title="Run with PM2 (keep alive 24/7)"
                  code={`npm install -g pm2\npm2 start server.js --name "telegram-bot"\npm2 save\npm2 startup`}
                />
              </div>
            </div>

            {/* Environment Variables */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h3 className="text-white font-bold text-lg mb-4">🔐 Environment Variables</h3>
              <div className="space-y-3">
                {[
                  { key: 'BOT_TOKEN', val: '8392101543:AAF_vP6_Y-5lSTJ3O8ZvFFT0pI_2_wTgebE', req: true, desc: 'Your Telegram bot token from @BotFather' },
                  { key: 'MONGODB_URI', val: 'mongodb://localhost:27017/telegram_game_bot', req: true, desc: 'MongoDB connection string' },
                  { key: 'OPENROUTER_API_KEY', val: 'your_key_here', req: true, desc: 'Get free key at openrouter.ai' },
                  { key: 'PORT', val: '3000', req: false, desc: 'HTTP server port (default: 3000)' },
                  { key: 'NODE_ENV', val: 'production', req: false, desc: 'Environment mode' },
                ].map((env, i) => (
                  <div key={i} className="bg-black/30 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-yellow-400 text-sm font-mono">{env.key}</code>
                      <span className={`text-xs px-2 py-0.5 rounded ${env.req ? 'bg-red-900/30 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
                        {env.req ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    <code className="text-green-400 text-xs font-mono block mb-1">{env.val}</code>
                    <p className="text-gray-500 text-xs">{env.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Troubleshooting */}
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6">
              <h3 className="text-yellow-400 font-bold mb-4">⚠️ Common Issues & Fixes</h3>
              <div className="space-y-4">
                {[
                  { problem: 'Bot not responding', fix: 'Check BOT_TOKEN is correct. Run: node -e "console.log(process.env.BOT_TOKEN)"' },
                  { problem: 'MongoDB connection failed', fix: 'Ensure MongoDB is running: mongod --version && systemctl status mongod' },
                  { problem: 'AI not working', fix: 'Bot works without OpenRouter key (uses fallback). Get free key at openrouter.ai' },
                  { problem: 'Port already in use', fix: 'Change PORT in .env or kill process: lsof -i :3000 && kill -9 PID' },
                ].map((item, i) => (
                  <div key={i}>
                    <p className="text-red-400 text-sm font-medium">❌ {item.problem}</p>
                    <p className="text-green-400 text-xs mt-1 font-mono">✅ {item.fix}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ── API TAB ── */}
      {activeTab === 'api' && (
        <main className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold text-white mb-2">🤖 AI & API Reference</h2>
            <p className="text-gray-400 text-sm mb-8">OpenRouter API integration details and game economy configuration</p>

            {/* OpenRouter */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🤖</span>
                <div>
                  <h3 className="text-white font-bold text-lg">OpenRouter AI API</h3>
                  <p className="text-gray-500 text-sm">Powers Tic Tac Toe AI, Quiz Generation & Chat</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {[
                  { label: 'Endpoint', value: 'https://openrouter.ai/api/v1/chat/completions' },
                  { label: 'Model', value: 'openai/gpt-4o-mini' },
                  { label: 'Fallback Model', value: 'openai/gpt-oss-120b:free' },
                  { label: 'Auth', value: 'Bearer token in Authorization header' },
                ].map((item, i) => (
                  <div key={i} className="bg-black/30 rounded-lg p-3 border border-white/10">
                    <p className="text-gray-500 text-xs mb-1">{item.label}</p>
                    <code className="text-blue-300 text-xs font-mono">{item.value}</code>
                  </div>
                ))}
              </div>

              <h4 className="text-white font-semibold text-sm mb-3">AI Features:</h4>
              <div className="space-y-3">
                {[
                  { feature: 'Tic Tac Toe AI', desc: 'Uses Minimax algorithm (perfect play) as primary. Falls back to OpenRouter API if needed.', badge: 'Minimax + AI' },
                  { feature: 'Quiz Generation', desc: 'Generates 5 unique trivia questions per game. Falls back to hardcoded questions if API fails.', badge: 'AI Generated' },
                  { feature: 'Chat Assistant', desc: 'Users can chat with AI using /ai command. Friendly, concise responses.', badge: 'OpenRouter' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-black/20 rounded-lg p-3 border border-white/5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-medium">{item.feature}</span>
                        <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">{item.badge}</span>
                      </div>
                      <p className="text-gray-400 text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Game Economy */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h3 className="text-white font-bold text-lg mb-4">💰 Coin Economy</h3>
              <div className="space-y-2">
                {[
                  { action: 'New User Welcome Bonus', amount: '+100 coins', color: 'text-green-400' },
                  { action: 'Game Entry Fee', amount: '-10 coins', color: 'text-red-400' },
                  { action: 'Win vs AI (Tic Tac Toe)', amount: '+25 coins', color: 'text-green-400' },
                  { action: 'Win vs Player (PvP)', amount: '+50 coins', color: 'text-green-400' },
                  { action: 'Draw (refund)', amount: '+10 coins', color: 'text-yellow-400' },
                  { action: 'Quiz Perfect (80%+)', amount: '+bonus 50 coins', color: 'text-green-400' },
                  { action: 'Quiz Good (60-79%)', amount: '+bonus 20 coins', color: 'text-green-400' },
                  { action: 'Quiz Low (<60%)', amount: '+quiz score only', color: 'text-gray-400' },
                  { action: 'Correct Quiz Answer', amount: '+20 points', color: 'text-blue-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-gray-300 text-sm">{item.action}</span>
                    <span className={`font-mono font-bold text-sm ${item.color}`}>{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* WebSocket API */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4">⚡ WebSocket Events</h3>
              <p className="text-gray-400 text-sm mb-4">Connect via: <code className="text-blue-400">ws://localhost:3000</code></p>
              <div className="space-y-3">
                {[
                  { event: 'register', dir: 'client → server', data: '{ type: "register", userId: "12345" }', desc: 'Register user for targeted messages' },
                  { event: 'registered', dir: 'server → client', data: '{ type: "registered", userId: "12345" }', desc: 'Confirmation of registration' },
                  { event: 'welcome', dir: 'server → client', data: '{ type: "welcome", message: "Connected to Game Server" }', desc: 'Sent on new connection' },
                  { event: 'gameUpdate', dir: 'server → client', data: '{ type: "gameUpdate", gameId: "...", board: [...] }', desc: 'Game state changed' },
                ].map((item, i) => (
                  <div key={i} className="bg-black/30 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-blue-400 font-mono text-sm">{item.event}</span>
                      <span className="text-xs text-gray-500">{item.dir}</span>
                    </div>
                    <code className="text-green-400 text-xs block mb-1">{item.data}</code>
                    <p className="text-gray-500 text-xs">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-4 px-4 text-center">
        <p className="text-gray-600 text-xs">
          🎮 Telegram Multiplayer Game Bot • Node.js + Telegraf + MongoDB + OpenRouter AI •{' '}
          <span className="text-blue-500">Production Ready</span>
        </p>
      </footer>
    </div>
  );
}
