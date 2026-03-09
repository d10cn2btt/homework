import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [content, setContent] = useState('');

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    if (!content.trim() || disabled) return;
    onSend(content.trim());
    setContent('');
  }

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-gray-200 bg-white">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Đang kết nối...' : 'Nhập tin nhắn...'}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
      <button
        onClick={submit}
        disabled={disabled || !content.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Gửi
      </button>
    </div>
  );
}
