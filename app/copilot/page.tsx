'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'Quais são os principais preparatórios de residência médica no Brasil?',
  'Me ajuda a montar argumentos de venda para faculdades de medicina',
  'O que é o PROFIMED e como impacta o mercado?',
  'Quais perguntas fazer em uma call de descoberta com um preparatório?',
  'Me explica o mercado de certificações financeiras ANBIMA',
  'Como abordar um decisor de uma edtech por email?',
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erro: ' + data.error }]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Erro: ' + e.message }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Copiloto</h1>
          <p className="text-slate-400 text-sm mt-1">Assistente comercial da MIIA</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">
            Nova conversa
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="py-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-miia-400 to-miia-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-miia-500/20">
                <span className="text-white text-2xl">✦</span>
              </div>
              <p className="text-slate-500 text-sm">Como posso ajudar hoje?</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p)}
                  className="text-left px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-miia-300 hover:text-miia-600 hover:bg-miia-50 transition-all">
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                msg.role === 'user'
                  ? 'bg-miia-500 text-white'
                  : 'bg-gradient-to-br from-miia-400 to-miia-600 text-white'
              }`}>
                {msg.role === 'user' ? 'Eu' : '✦'}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-miia-500 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex-shrink-0 bg-gradient-to-br from-miia-400 to-miia-600 flex items-center justify-center text-white text-xs font-bold">✦</div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-miia-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-miia-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-miia-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex gap-3 items-end bg-white border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-miia-300 focus-within:ring-2 focus-within:ring-miia-400/20 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none text-sm text-slate-700 placeholder-slate-400 focus:outline-none bg-transparent max-h-32"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 bg-miia-500 text-white rounded-xl flex items-center justify-center hover:bg-miia-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-300 mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
      </div>
    </div>
  );
}
